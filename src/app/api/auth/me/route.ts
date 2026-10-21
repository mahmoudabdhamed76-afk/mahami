import { z } from "zod";
import { prisma } from "@/server/db";
import { api, body, HttpError, json } from "@/server/http";
import { currentUser, endSession, requireUser, toUserDTO, verifyPassword } from "@/server/auth";
import { settingsSchema } from "@/lib/schemas";

/** Returns `{ user: null }` (not 401) for anonymous visitors so the app can boot quietly. */
export const GET = api(async () => {
  const user = await currentUser();
  return json({ user: user ? toUserDTO(user) : null });
});

const patch = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  timezone: z.string().max(64).optional(),
  settings: settingsSchema.optional(),
});

export const PATCH = api(async (req) => {
  const user = await requireUser();
  const d = patch.parse(await body(req));
  if (d.timezone) {
    try { new Intl.DateTimeFormat("en", { timeZone: d.timezone }); } catch { d.timezone = undefined; }
  }
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      name: d.name,
      timezone: d.timezone,
      settings: d.settings ? { ...(user.settings as object), ...d.settings } : undefined,
    },
  });
  return json({ user: toUserDTO(updated) });
});

export const DELETE = api(async (req) => {
  const user = await requireUser();
  const { password } = z.object({ password: z.string().min(1) }).parse(await body(req));
  if (!(await verifyPassword(password, user.passwordHash))) throw new HttpError(403, "كلمة المرور غير صحيحة");
  await prisma.user.delete({ where: { id: user.id } });
  await endSession();
  return json({ ok: true });
});
