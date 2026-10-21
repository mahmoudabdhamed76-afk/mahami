import { randomUUID } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/server/db";
import { api, body, clientIp, HttpError, json, rateLimit } from "@/server/http";
import { hashPassword, newToken, startSession, toUserDTO } from "@/server/auth";
import { emailSchema, passwordSchema } from "@/lib/schemas";

const schema = z.object({
  name: z.string().trim().min(2, "الاسم قصير جدًا").max(80),
  email: emailSchema,
  password: passwordSchema,
  timezone: z.string().max(64).optional(),
});

function validTz(tz?: string) {
  if (!tz) return "Africa/Cairo";
  try { new Intl.DateTimeFormat("en", { timeZone: tz }); return tz; } catch { return "Africa/Cairo"; }
}

export const POST = api(async (req) => {
  rateLimit(`register:${clientIp(req)}`, 10, 60 * 60_000);
  const { name, email, password, timezone } = schema.parse(await body(req));
  if (await prisma.user.findUnique({ where: { email } })) throw new HttpError(409, "هذا البريد مسجّل بالفعل", "email_taken");
  const passwordHash = await hashPassword(password);
  const user = await prisma.$transaction(async (tx) => {
    const u = await tx.user.create({
      data: { name, email, passwordHash, timezone: validTz(timezone), calendarToken: newToken(24), settings: {} },
    });
    // Starter lists so a new account isn't empty
    const starters = [
      { name: "شخصي", color: "#007AFF", icon: "user" },
      { name: "العمل", color: "#FF9500", icon: "briefcase" },
      { name: "التسوّق", color: "#34C759", icon: "shopping-cart" },
    ];
    await tx.category.createMany({ data: starters.map((c, i) => ({ id: randomUUID(), userId: u.id, sortOrder: i, ...c })) });
    return u;
  });
  await startSession(req, user.id);
  return json({ user: toUserDTO(user) }, { status: 201 });
});
