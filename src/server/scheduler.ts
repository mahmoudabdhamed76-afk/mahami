import { prisma, table } from "./db";
import { sendToUser } from "./push";

const g = globalThis as unknown as { __reminderTimer?: NodeJS.Timeout };

type Due = { id: string; userId: string; title: string; notes: string | null; dueAt: Date | null; allDay: boolean; timezone: string };

function describe(t: Due) {
  if (!t.dueAt) return t.notes?.slice(0, 120) || "تذكير بمهمتك";
  const opts: Intl.DateTimeFormatOptions = t.allDay
    ? { weekday: "long", day: "numeric", month: "long", timeZone: t.timezone }
    : { weekday: "long", hour: "numeric", minute: "2-digit", timeZone: t.timezone };
  let when = "";
  try { when = new Intl.DateTimeFormat("ar-EG", opts).format(t.dueAt); } catch { when = t.dueAt.toISOString(); }
  return `الموعد: ${when}${t.notes ? ` — ${t.notes.slice(0, 80)}` : ""}`;
}

/** Claims due reminders atomically (SKIP LOCKED makes it safe with many instances) and sends Web Push. */
export async function runReminderTick() {
  const due = await prisma.$queryRaw<Due[]>`
    UPDATE ${table("Task")} AS t SET "reminderSentAt" = now()
    FROM ${table("User")} AS u
    WHERE u.id = t."userId" AND t.id IN (
      SELECT id FROM ${table("Task")}
      WHERE "remindAt" <= now() AND "remindAt" > now() - interval '12 hours'
        AND "remindAt" >= "clientUpdatedAt" - interval '1 minute'
        AND "reminderSentAt" IS NULL AND "deletedAt" IS NULL AND completed = false
      ORDER BY "remindAt" LIMIT 200
      FOR UPDATE SKIP LOCKED)
    RETURNING t.id, t."userId", t.title, t.notes, t."dueAt", t."allDay", u.timezone`;
  for (const t of due) {
    await sendToUser(t.userId, {
      title: `⏰ ${t.title}`,
      body: describe(t),
      tag: `task-${t.id}`,
      url: `/?task=${t.id}`,
      taskId: t.id,
    }).catch((e) => console.error("[reminders]", e));
  }
  return due.length;
}

export function startReminderScheduler() {
  const interval = Number(process.env.REMINDER_INTERVAL_MS ?? 20_000);
  if (!interval || g.__reminderTimer || !process.env.DATABASE_URL) return;
  let busy = false;
  g.__reminderTimer = setInterval(async () => {
    if (busy) return;
    busy = true;
    try { await runReminderTick(); } catch (e) { console.error("[reminders] tick failed:", (e as Error).message); }
    finally { busy = false; }
  }, interval);
  g.__reminderTimer.unref?.();
  console.log(`[reminders] scheduler started (every ${interval / 1000}s)`);
}

let lastTick = 0;
/** Throttled tick used on serverless hosts where no background interval exists. */
export async function maybeRunReminders() {
  if (Date.now() - lastTick < 30_000) return;
  lastTick = Date.now();
  try { await runReminderTick(); } catch (e) { console.error("[reminders]", (e as Error).message); }
}
