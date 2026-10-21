// Local-time date helpers (no external date library).
export const DAY = 864e5;

export const startOfDay = (d: Date | number) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
export const endOfDay = (d: Date | number) => { const x = new Date(d); x.setHours(23, 59, 59, 999); return x; };
export const addDays = (d: Date | number, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
export const addMonths = (d: Date | number, n: number) => { const x = new Date(d); const day = x.getDate(); x.setDate(1); x.setMonth(x.getMonth() + n); x.setDate(Math.min(day, daysInMonth(x))); return x; };
export const daysInMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
export const startOfMonth = (d: Date | number) => { const x = startOfDay(d); x.setDate(1); return x; };
export const startOfWeek = (d: Date | number, weekStart: number) => {
  const x = startOfDay(d);
  const diff = (x.getDay() - weekStart + 7) % 7;
  return addDays(x, -diff);
};
export const isSameDay = (a: Date | number, b: Date | number) => startOfDay(a).getTime() === startOfDay(b).getTime();
export const dayKey = (d: Date | number) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
};
export const fromDayKey = (k: string) => { const [y, m, d] = k.split("-").map(Number); return new Date(y, m - 1, d); };
export const timeKey = (d: Date | number) => { const x = new Date(d); return `${String(x.getHours()).padStart(2, "0")}:${String(x.getMinutes()).padStart(2, "0")}`; };
export const combine = (day: string, time: string | null) => {
  const d = fromDayKey(day);
  if (time) { const [h, m] = time.split(":").map(Number); d.setHours(h, m, 0, 0); }
  return d;
};
export const daysBetween = (a: Date | number, b: Date | number) => Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / DAY);
