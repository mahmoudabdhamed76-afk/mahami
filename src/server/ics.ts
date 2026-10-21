import type { Task } from "@/generated/prisma/client";

const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
const utc = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

/** Fold lines to 75 octets as RFC 5545 requires (UTF-8 aware). */
function fold(line: string) {
  const enc = new TextEncoder();
  if (enc.encode(line).length <= 75) return line;
  const out: string[] = [];
  let cur = "";
  for (const ch of line) {
    if (enc.encode(cur + ch).length > (out.length ? 74 : 75)) { out.push(cur); cur = ""; }
    cur += ch;
  }
  out.push(cur);
  return out.join("\r\n ");
}

function localDate(d: Date, tz: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  return parts.replace(/-/g, "");
}

function nextDay(yyyymmdd: string) {
  const d = new Date(Date.UTC(+yyyymmdd.slice(0, 4), +yyyymmdd.slice(4, 6) - 1, +yyyymmdd.slice(6, 8) + 1));
  return d.toISOString().slice(0, 10).replace(/-/g, "");
}

export function buildCalendar(tasks: Task[], opts: { name: string; timezone: string; host: string }) {
  const lines = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Mahami//Task Manager//AR", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    `X-WR-CALNAME:${esc(`مهامي — ${opts.name}`)}`, `X-WR-TIMEZONE:${opts.timezone}`,
    "REFRESH-INTERVAL;VALUE=DURATION:PT15M", "X-PUBLISHED-TTL:PT15M",
  ];
  for (const t of tasks) {
    if (!t.dueAt) continue;
    lines.push("BEGIN:VEVENT", `UID:${t.id}@${opts.host}`, `DTSTAMP:${utc(t.clientUpdatedAt)}`);
    if (t.allDay) {
      const day = localDate(t.dueAt, opts.timezone);
      lines.push(`DTSTART;VALUE=DATE:${day}`, `DTEND;VALUE=DATE:${nextDay(day)}`);
    } else {
      lines.push(`DTSTART:${utc(t.dueAt)}`, `DTEND:${utc(new Date(t.dueAt.getTime() + 30 * 60_000))}`);
    }
    lines.push(`SUMMARY:${esc((t.completed ? "✓ " : "") + t.title)}`);
    if (t.notes) lines.push(`DESCRIPTION:${esc(t.notes)}`);
    if (t.completed) lines.push("STATUS:CONFIRMED", "TRANSP:TRANSPARENT");
    if (t.priority) lines.push(`PRIORITY:${[0, 9, 5, 1][t.priority]}`);
    if (t.remindAt && !t.completed) {
      lines.push("BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${esc(t.title)}`, `TRIGGER;VALUE=DATE-TIME:${utc(t.remindAt)}`, "END:VALARM");
    }
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}
