import { randomUUID } from "node:crypto";
import { prisma } from "@/server/db";
import { api, body, json } from "@/server/http";
import { requireUser } from "@/server/auth";
import { serializeCategory } from "@/server/sync";
import { writeEntity } from "@/server/rest";
import { categoryData } from "@/lib/schemas";

export const GET = api(async () => {
  const user = await requireUser();
  const cats = await prisma.category.findMany({ where: { userId: user.id, deletedAt: null }, orderBy: { sortOrder: "asc" } });
  const counts = await prisma.task.groupBy({
    by: ["categoryId"], where: { userId: user.id, deletedAt: null, completed: false }, _count: { _all: true },
  });
  const map = new Map(counts.map((c) => [c.categoryId, c._count._all]));
  return json({ categories: cats.map((c) => ({ ...serializeCategory(c), activeTasks: map.get(c.id) ?? 0 })) });
});

export const POST = api(async (req) => {
  const user = await requireUser();
  const data = categoryData.parse(await body(req));
  const id = randomUUID();
  await writeEntity(user.id, "category", "upsert", id, data);
  return json({ category: serializeCategory(await prisma.category.findUniqueOrThrow({ where: { id } })) }, { status: 201 });
});
