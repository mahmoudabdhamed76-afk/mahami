import { prisma } from "./db";
import { categoryData, subtaskData, taskData } from "@/lib/schemas";
import type { CategoryRec, PullResponse, PushResult, SubtaskRec, SyncOp, TaskRec } from "@/lib/types";
import type { Category, Subtask, Task } from "@/generated/prisma/client";

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];
type Result = PushResult["results"][number];

const iso = (d: Date | null) => (d ? d.toISOString() : null);

// ── Serialization ───────────────────────────────────────────────────────────
export const serializeCategory = (c: Category): CategoryRec & { version: number } => ({
  id: c.id, name: c.name, color: c.color, icon: c.icon, sortOrder: c.sortOrder,
  createdAt: c.createdAt.toISOString(), updatedAt: c.clientUpdatedAt.toISOString(), deletedAt: iso(c.deletedAt),
  version: Number(c.version),
});

export const serializeTask = (t: Task): TaskRec & { version: number } => ({
  id: t.id, title: t.title, notes: t.notes, priority: t.priority as TaskRec["priority"], categoryId: t.categoryId,
  dueAt: iso(t.dueAt), allDay: t.allDay, remindAt: iso(t.remindAt), reminderOffset: t.reminderOffset,
  completed: t.completed, completedAt: iso(t.completedAt), sortOrder: t.sortOrder,
  createdAt: t.createdAt.toISOString(), updatedAt: t.clientUpdatedAt.toISOString(), deletedAt: iso(t.deletedAt),
  version: Number(t.version),
});

export const serializeSubtask = (s: Subtask): SubtaskRec & { version: number } => ({
  id: s.id, taskId: s.taskId, title: s.title, done: s.done, sortOrder: s.sortOrder,
  createdAt: s.createdAt.toISOString(), updatedAt: s.clientUpdatedAt.toISOString(), deletedAt: iso(s.deletedAt),
  version: Number(s.version),
});

// ── Push: apply client operations with last-write-wins ──────────────────────
const ENTITY_ORDER = { category: 0, task: 1, subtask: 2 } as const;

/**
 * Applies a batch of operations for one user inside a single transaction.
 * A per-user advisory lock serializes concurrent pushes from several devices,
 * so the LWW comparison below is race-free.
 */
export async function applyOps(userId: string, ops: SyncOp[], clientNow?: string): Promise<PushResult> {
  const serverNow = Date.now();
  // Compensate for a device clock that is off (bounded to ±7 days)
  let skew = 0;
  if (clientNow) {
    const c = Date.parse(clientNow);
    if (Number.isFinite(c)) skew = Math.max(-7 * 864e5, Math.min(7 * 864e5, serverNow - c));
  }
  const tsOf = (op: SyncOp) => new Date(Math.min(Date.parse(op.ts) + skew, serverNow + 60_000));

  // Upserts parent-first, deletes child-first; stable within each group.
  const sorted = ops
    .map((op, i) => ({ op, i }))
    .sort((a, b) => {
      const ka = a.op.op === "upsert" ? ENTITY_ORDER[a.op.entity] : 10 - ENTITY_ORDER[a.op.entity];
      const kb = b.op.op === "upsert" ? ENTITY_ORDER[b.op.entity] : 10 - ENTITY_ORDER[b.op.entity];
      return ka - kb || a.i - b.i;
    })
    .map((x) => x.op);

  const results: Result[] = [];
  await prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}::text))`;
      for (const op of sorted) {
        try {
          results.push(await applyOne(tx, userId, op, tsOf(op)));
        } catch (e) {
          if (e && typeof e === "object" && "issues" in e) {
            results.push({ opId: op.opId, status: "rejected", reason: "invalid" });
          } else throw e;
        }
      }
    },
    { timeout: 30_000, maxWait: 10_000 },
  );
  return { results };
}

async function applyOne(tx: Tx, userId: string, op: SyncOp, ts: Date): Promise<Result> {
  const ok = (status: Result["status"], reason?: string): Result => ({ opId: op.opId, status, reason });

  if (op.entity === "category") {
    const existing = await tx.category.findUnique({ where: { id: op.id } });
    if (existing && existing.userId !== userId) return ok("rejected", "forbidden");
    if (existing && existing.clientUpdatedAt > ts) return ok("stale");
    if (op.op === "delete") {
      if (!existing || existing.deletedAt) return ok("applied");
      await tx.category.update({ where: { id: op.id }, data: { deletedAt: new Date(), clientUpdatedAt: ts } });
      await tx.task.updateMany({ where: { userId, categoryId: op.id }, data: { categoryId: null } });
      return ok("applied");
    }
    const d = categoryData.parse(op.data ?? {});
    const fields = { name: d.name, color: d.color, icon: d.icon, sortOrder: d.sortOrder };
    await tx.category.upsert({
      where: { id: op.id },
      create: { id: op.id, userId, ...fields, clientUpdatedAt: ts, createdAt: d.createdAt ? new Date(d.createdAt) : ts },
      update: { ...fields, clientUpdatedAt: ts, deletedAt: null },
    });
    return ok("applied");
  }

  if (op.entity === "task") {
    const existing = await tx.task.findUnique({ where: { id: op.id } });
    if (existing && existing.userId !== userId) return ok("rejected", "forbidden");
    if (existing && existing.clientUpdatedAt > ts) return ok("stale");
    if (op.op === "delete") {
      if (!existing || existing.deletedAt) return ok("applied");
      const now = new Date();
      await tx.task.update({ where: { id: op.id }, data: { deletedAt: now, clientUpdatedAt: ts } });
      await tx.subtask.updateMany({ where: { taskId: op.id, deletedAt: null }, data: { deletedAt: now } });
      return ok("applied");
    }
    const d = taskData.parse(op.data ?? {});
    let categoryId = d.categoryId;
    if (categoryId) {
      const cat = await tx.category.findUnique({ where: { id: categoryId }, select: { userId: true, deletedAt: true } });
      if (!cat || cat.userId !== userId || cat.deletedAt) categoryId = null;
    }
    const dueAt = d.dueAt ? new Date(d.dueAt) : null;
    let remindAt = d.remindAt ? new Date(d.remindAt) : null;
    if (d.reminderOffset != null && dueAt) remindAt = new Date(dueAt.getTime() - d.reminderOffset * 60_000);
    const completedAt = d.completed ? (d.completedAt ? new Date(d.completedAt) : new Date()) : null;
    const reminderChanged = !existing || (existing.remindAt?.getTime() ?? null) !== (remindAt?.getTime() ?? null);
    const fields = {
      title: d.title, notes: d.notes || null, priority: d.priority, categoryId, dueAt, allDay: d.allDay,
      remindAt, reminderOffset: remindAt ? d.reminderOffset : null, completed: d.completed, completedAt, sortOrder: d.sortOrder,
    };
    await tx.task.upsert({
      where: { id: op.id },
      create: { id: op.id, userId, ...fields, clientUpdatedAt: ts, createdAt: d.createdAt ? new Date(d.createdAt) : ts },
      update: { ...fields, clientUpdatedAt: ts, deletedAt: null, ...(reminderChanged ? { reminderSentAt: null } : {}) },
    });
    return ok("applied");
  }

  // subtask
  const existing = await tx.subtask.findUnique({ where: { id: op.id } });
  if (existing && existing.userId !== userId) return ok("rejected", "forbidden");
  if (existing && existing.clientUpdatedAt > ts) return ok("stale");
  if (op.op === "delete") {
    if (!existing || existing.deletedAt) return ok("applied");
    await tx.subtask.update({ where: { id: op.id }, data: { deletedAt: new Date(), clientUpdatedAt: ts } });
    return ok("applied");
  }
  const d = subtaskData.parse(op.data ?? {});
  const parent = await tx.task.findUnique({ where: { id: d.taskId }, select: { userId: true, deletedAt: true } });
  if (!parent || parent.userId !== userId) return ok("rejected", "parent_missing");
  if (parent.deletedAt) return ok("stale");
  const fields = { taskId: d.taskId, title: d.title, done: d.done, sortOrder: d.sortOrder };
  await tx.subtask.upsert({
    where: { id: op.id },
    create: { id: op.id, userId, ...fields, clientUpdatedAt: ts, createdAt: d.createdAt ? new Date(d.createdAt) : ts },
    update: { ...fields, clientUpdatedAt: ts, deletedAt: null },
  });
  return ok("applied");
}

// ── Pull: everything changed since a cursor ─────────────────────────────────
export async function pullChanges(userId: string, since: number, limit = 500): Promise<PullResponse> {
  const where = { userId, version: { gt: BigInt(Math.max(0, Math.floor(since))) } };
  const args = { where, orderBy: { version: "asc" as const }, take: limit };
  const [cats, tasks, subs] = await Promise.all([
    prisma.category.findMany(args),
    prisma.task.findMany(args),
    prisma.subtask.findMany(args),
  ]);

  // If any table was truncated, cap the page at the smallest "last version"
  // among truncated tables so the cursor never skips unseen rows.
  let cap = Infinity;
  for (const list of [cats, tasks, subs]) if (list.length === limit) cap = Math.min(cap, Number(list[list.length - 1].version));
  const keep = <T extends { version: bigint }>(l: T[]) => (cap === Infinity ? l : l.filter((r) => Number(r.version) <= cap));
  const c2 = keep(cats), t2 = keep(tasks), s2 = keep(subs);
  const maxV = Math.max(since, ...[...c2, ...t2, ...s2].map((r) => Number(r.version)));

  return {
    cursor: cap === Infinity ? maxV : cap,
    hasMore: cap !== Infinity,
    categories: c2.map(serializeCategory),
    tasks: t2.map(serializeTask),
    subtasks: s2.map(serializeSubtask),
  };
}
