import { z } from "zod";
import { prisma } from "@/server/db";
import { api, body, clientIp, HttpError, json, rateLimit } from "@/server/http";
import { startSession, toUserDTO, verifyPassword } from "@/server/auth";
import { emailSchema } from "@/lib/schemas";

const schema = z.object({ email: emailSchema, password: z.string().min(1, "أدخل كلمة المرور").max(200) });

export const POST = api(async (req) => {
  const { email, password } = schema.parse(await body(req));
  rateLimit(`login:${clientIp(req)}`, 30, 15 * 60_000);
  rateLimit(`login:${email}`, 8, 15 * 60_000);
  const user = await prisma.user.findUnique({ where: { email } });
  // Always run the hash check to keep timing uniform
  const valid = await verifyPassword(password, user?.passwordHash ?? "scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA==$" + "A".repeat(86) + "==");
  if (!user || !valid) throw new HttpError(401, "البريد الإلكتروني أو كلمة المرور غير صحيحة", "bad_credentials");
  await startSession(req, user.id);
  return json({ user: toUserDTO(user) });
});
