import { prisma } from "@/server/db";
import { api, body, HttpError, json } from "@/server/http";
import { requireUser } from "@/server/auth";
import { serializeCategory } from "@/server/sync";
import { writeEntity } from "@/server/rest";
import { categoryData } from "@/lib/schemas";

async function load(userId: string, id: string) {
  const c = await prisma.category.findFirst({ where: { id, userId, deletedAt: null } });
  if (!c) throw new HttpError(404, "القائمة غير موجودة");
  return c;
}

export const PATCH = api(async (req, ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const cur = serializeCategory(await load(user.id, id));
  await writeEntity(user.id, "category", "upsert", id, categoryData.parse({ ...cur, ...(await body(req) as object) }));
  return json({ category: serializeCategory(await load(user.id, id)) });
});

export const DELETE = api(async (_req, ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  await load(user.id, id);
  await writeEntity(user.id, "category", "delete", id);
  return json({ ok: true });
});
