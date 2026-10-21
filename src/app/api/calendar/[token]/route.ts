import { prisma } from "@/server/db";
import { buildCalendar } from "@/server/ics";

export const dynamic = "force-dynamic";

/** Public iCalendar feed (secret token in URL) — subscribe from Google / Apple / Outlook Calendar. */
export async function GET(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const token = (await ctx.params).token.replace(/\.ics$/i, "");
  if (!token || token.length > 64) return new Response("Not found", { status: 404 });
  const user = await prisma.user.findUnique({ where: { calendarToken: token } });
  if (!user) return new Response("Not found", { status: 404 });
  const since = new Date(Date.now() - 90 * 864e5);
  const tasks = await prisma.task.findMany({
    where: { userId: user.id, deletedAt: null, dueAt: { gte: since } },
    orderBy: { dueAt: "asc" },
    take: 5000,
  });
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "mahami";
  return new Response(buildCalendar(tasks, { name: user.name, timezone: user.timezone, host }), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="mahami.ics"',
      "Cache-Control": "private, max-age=300",
    },
  });
}
