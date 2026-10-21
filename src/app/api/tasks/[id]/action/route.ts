import { z } from "zod";
import { prisma } from "@/server/db";
import { api, body, HttpError, json } from "@/server/http";
import { requireUser } from "@/server/auth";
import { serializeTask } from "@/server/sync";
import { writeEntity } from "@/server/rest";

/** Quick actions used by notification buttons: complete / snooze. */
export const POST = api(async (req, ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const { action, minutes } = z
    .object({ action: z.enum(["complete", "snooze"]), minutes: z.number().int().min(1).max(1440).default(10) })
    .parse(await body(req));
  const task = await prisma.task.findFirst({ where: { id, userId: user.id, deletedAt: null } });
  if (!task) throw new HttpError(404, "المهمة غير موجودة");
  const cur = serializeTask(task);
  const next =
    action === "complete"
      ? { ...cur, completed: true, completedAt: new Date().toISOString() }
      : { ...cur, reminderOffset: null, remindAt: new Date(Date.now() + minutes * 60_000).toISOString() };
  await writeEntity(user.id, "task", "upsert", id, next);
  return json({ ok: true });
});
