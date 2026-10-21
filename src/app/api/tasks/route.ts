import { randomUUID } from "node:crypto";
import { prisma } from "@/server/db";
import { api, body, json } from "@/server/http";
import { requireUser } from "@/server/auth";
import { serializeSubtask, serializeTask } from "@/server/sync";
import { writeEntity } from "@/server/rest";
import { taskData } from "@/lib/schemas";
import type { Prisma } from "@/generated/prisma/client";

/**
 * GET /api/tasks?status=active|completed|all&q=&categoryId=&priority=&from=&to=&limit=&offset=
 */
export const GET = api(async (req) => {
  const user = await requireUser();
  const p = new URL(req.url).searchParams;
  const where: Prisma.TaskWhereInput = { userId: user.id, deletedAt: null };
  const status = p.get("status") ?? "all";
  if (status === "active") where.completed = false;
  if (status === "completed") where.completed = true;
  if (p.get("categoryId")) where.categoryId = p.get("categoryId");
  if (p.get("priority")) where.priority = Number(p.get("priority"));
  const from = p.get("from"), to = p.get("to");
  if (from || to) where.dueAt = { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lt: new Date(to) } : {}) };
  const q = p.get("q")?.trim();
  if (q) where.OR = [{ title: { contains: q, mode: "insensitive" } }, { notes: { contains: q, mode: "insensitive" } }];
  const take = Math.min(Number(p.get("limit") ?? 200) || 200, 1000);
  const skip = Number(p.get("offset") ?? 0) || 0;
  const [tasks, total] = await Promise.all([
    prisma.task.findMany({
      where, take, skip,
      orderBy: [{ completed: "asc" }, { dueAt: { sort: "asc", nulls: "last" } }, { priority: "desc" }, { createdAt: "desc" }],
      include: { subtasks: { where: { deletedAt: null }, orderBy: { sortOrder: "asc" } } },
    }),
    prisma.task.count({ where }),
  ]);
  return json({
    total,
    tasks: tasks.map((t) => ({ ...serializeTask(t), subtasks: t.subtasks.map(serializeSubtask) })),
  });
});

/** POST /api/tasks — create a task (optionally with `subtasks: [{title}]`). */
export const POST = api(async (req) => {
  const user = await requireUser();
  const raw = (await body(req)) as Record<string, unknown>;
  const data = taskData.parse(raw);
  const id = randomUUID();
  await writeEntity(user.id, "task", "upsert", id, data);
  const subs = Array.isArray(raw.subtasks) ? raw.subtasks.slice(0, 100) : [];
  for (let i = 0; i < subs.length; i++) {
    const title = String((subs[i] as { title?: unknown })?.title ?? "").trim();
    if (title) await writeEntity(user.id, "subtask", "upsert", randomUUID(), { taskId: id, title, sortOrder: i });
  }
  const task = await prisma.task.findUniqueOrThrow({
    where: { id }, include: { subtasks: { where: { deletedAt: null }, orderBy: { sortOrder: "asc" } } },
  });
  return json({ task: { ...serializeTask(task), subtasks: task.subtasks.map(serializeSubtask) } }, { status: 201 });
});
