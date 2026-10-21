import { prisma } from "@/server/db";
import { api, json } from "@/server/http";
import { newToken, requireUser } from "@/server/auth";

/** Rotate the calendar feed token (revokes old subscription links). */
export const POST = api(async () => {
  const user = await requireUser();
  const updated = await prisma.user.update({ where: { id: user.id }, data: { calendarToken: newToken(24) } });
  return json({ calendarToken: updated.calendarToken });
});
