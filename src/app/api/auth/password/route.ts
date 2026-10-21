import { z } from "zod";
import { prisma } from "@/server/db";
import { api, body, HttpError, json, rateLimit } from "@/server/http";
import { hashPassword, requireUser, verifyPassword } from "@/server/auth";
import { passwordSchema } from "@/lib/schemas";

export const POST = api(async (req) => {
  const user = await requireUser();
  rateLimit(`pw:${user.id}`, 5, 15 * 60_000);
  const { current, next } = z.object({ current: z.string().min(1), next: passwordSchema }).parse(await body(req));
  if (!(await verifyPassword(current, user.passwordHash))) throw new HttpError(403, "كلمة المرور الحالية غير صحيحة");
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(next) } });
  return json({ ok: true });
});
