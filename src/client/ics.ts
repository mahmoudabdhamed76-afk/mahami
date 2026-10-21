import type { TaskRec } from "@/lib/types";

const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
const utc = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const ymd = (d: Date) => `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;

function range(t: TaskRec): [string, string] | null {
  if (!t.dueAt) return null;
  const d = new Date(t.dueAt);
  if (t.allDay) { const e = new Date(d); e.setDate(e.getDate() + 1); return [ymd(d), ymd(e)]; }
  return [utc(d), utc(new Date(d.getTime() + 30 * 60_000))];
}

/** Download a single task as .ics (works offline). */
export function downloadIcs(t: TaskRec) {
  const r = range(t);
  if (!r) return;
  const val = t.allDay ? ";VALUE=DATE" : "";
  const lines = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Mahami//AR", "BEGIN:VEVENT",
    `UID:${t.id}@mahami`, `DTSTAMP:${utc(new Date())}`, `DTSTART${val}:${r[0]}`, `DTEND${val}:${r[1]}`,
    `SUMMARY:${esc(t.title)}`, ...(t.notes ? [`DESCRIPTION:${esc(t.notes)}`] : []),
    ...(t.remindAt ? ["BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${esc(t.title)}`, `TRIGGER;VALUE=DATE-TIME:${utc(new Date(t.remindAt))}`, "END:VALARM"] : []),
    "END:VEVENT", "END:VCALENDAR",
  ];
  const blob = new Blob([lines.join("\r\n")], { type: "text/calendar;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${t.title.slice(0, 40).replace(/[\\/:*?"<>|]/g, "")}.ics`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

export function googleCalendarUrl(t: TaskRec) {
  const r = range(t);
  const p = new URLSearchParams({ action: "TEMPLATE", text: t.title });
  if (r) p.set("dates", `${r[0]}/${r[1]}`);
  if (t.notes) p.set("details", t.notes);
  return `https://calendar.google.com/calendar/render?${p}`;
}
