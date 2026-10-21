import { prisma } from "@/server/db";
import { api, body, HttpError, json } from "@/server/http";
import { requireUser } from "@/server/auth";
import { serializeSubtask, serializeTask } from "@/server/sync";
import { writeEntity } from "@/server/rest";
import { taskData } from "@/lib/schemas";

async function load(userId: string, id: string) {
  const task = await prisma.task.findFirst({
    where: { id, userId, deletedAt: null },
    include: { subtasks: { where: { deletedAt: null }, orderBy: { sortOrder: "asc" } } },
  });
  if (!task) throw new HttpError(404, "المهمة غير موجودة");
  return task;
}
const out = (t: Awaited<ReturnType<typeof load>>) => ({ ...serializeTask(t), subtasks: t.subtasks.map(serializeSubtask) });

export const GET = api(async (_req, ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  return json({ task: out(await load(user.id, id)) });
});

export const PATCH = api(async (req, ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const current = serializeTask(await load(user.id, id));
  const merged = taskData.parse({ ...current, ...(await body(req) as object) });
  await writeEntity(user.id, "task", "upsert", id, merged);
  return json({ task: out(await load(user.id, id)) });
});

export const DELETE = api(async (_req, ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  await load(user.id, id);
  await writeEntity(user.id, "task", "delete", id);
  return json({ ok: true });
});
