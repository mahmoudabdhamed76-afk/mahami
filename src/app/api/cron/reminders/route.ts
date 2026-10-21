import { runReminderTick } from "@/server/scheduler";

export const dynamic = "force-dynamic";

/**
 * Reminder dispatcher for serverless hosts. Call every minute with
 * `Authorization: Bearer $CRON_SECRET` (Vercel Cron, Supabase pg_cron, cron-job.org…).
 */
async function handler(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const sent = await runReminderTick();
  return Response.json({ ok: true, sent, at: new Date().toISOString() });
}

export const GET = handler;
export const POST = handler;
