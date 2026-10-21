import { addDays, addMonths, startOfDay } from "./dates";
import { latinDigits, normalizeAr } from "./text";
import type { CategoryRec, Priority } from "@/lib/types";

/**
 * Arabic natural-language quick add (MSA + Egyptian dialect).
 *   "اجتماع الفريق بكرة الساعة 5 !عالية #العمل ذكرني"
 *   → title "اجتماع الفريق", tomorrow 17:00, high priority, list العمل, reminder on.
 */
export interface Parsed {
  title: string;
  dueAt: Date | null;
  allDay: boolean;
  priority: Priority;
  categoryName: string | null;
  category: CategoryRec | null;
  remind: boolean;
  hits: { date?: boolean; time?: boolean; priority?: boolean; category?: boolean; remind?: boolean };
}

const B = "(?:^|\\s)";      // word start
const E = "(?=\\s|$|[،,.!؟?])"; // word end
const A = "[اأإآ]";
const H = "[هة]";

const WEEKDAYS: [RegExp, number][] = [
  [new RegExp(`سبت`), 6], [new RegExp(`${A}حد`), 0], [new RegExp(`(?:${A}ث|${A}ت)نين`), 1],
  [new RegExp(`(?:ثلاثاء?|تلات|تلاتاء?)`), 2], [new RegExp(`${A}ربع(?:اء)?`), 3], [new RegExp(`خميس`), 4], [new RegExp(`جمع${H}`), 5],
];

const MERIDIEM = `(ص|م|صباح[اًا]?|مساء[اًا]?|مساءً|الصبح|بالليل|بليل|الظهر|الضهر|العصر|المغرب|العشا[ءء]?)`;

export function parseQuickAdd(input: string, categories: CategoryRec[], now = new Date()): Parsed {
  // `s` is matched against (ASCII digits); `orig` mirrors every cut so the title keeps the user's own digits.
  let s = latinDigits(input);
  let orig = input;
  const hits: Parsed["hits"] = {};
  const take = (re: RegExp, fn: (m: RegExpExecArray) => boolean | void) => {
    const m = re.exec(s);
    if (m && fn(m) !== false) {
      const cut = (x: string) => x.slice(0, m.index) + " " + x.slice(m.index + m[0].length);
      s = cut(s);
      orig = cut(orig);
    }
  };

  // Priority: !, !!, !!!, !عالية, !عاجل ...
  let priority: Priority = 0;
  take(new RegExp(`${B}(!{1,3})(عالي${H}?|عاجل|مهم|ضروري|متوسط${H}?|عادي${H}?|منخفض${H}?|قليل${H}?)?${E}`), (m) => {
    const w = m[2] ? normalizeAr(m[2]) : "";
    priority = (w ? (/عال|عاجل|مهم|ضروري/.test(w) ? 3 : /متوسط|عادي/.test(w) ? 2 : 1) : m[1].length) as Priority;
    hits.priority = true;
  });

  // Category: #name
  let categoryName: string | null = null;
  let category: CategoryRec | null = null;
  take(/(?:^|\s)#([^\s#]+)/, (m) => {
    categoryName = m[1].replace(/_/g, " ");
    const n = normalizeAr(categoryName);
    category = categories.find((c) => normalizeAr(c.name) === n)
      ?? categories.find((c) => normalizeAr(c.name).replace(/^ال/, "") === n.replace(/^ال/, ""))
      ?? categories.find((c) => normalizeAr(c.name).startsWith(n)) ?? null;
    hits.category = true;
  });

  // Reminder keyword
  let remind = false;
  take(new RegExp(`${B}(ذكرني|ذكّرني|فكرني|نبهني|نبّهني)${E}`), () => { remind = true; hits.remind = true; });

  // Time
  let hour: number | null = null, minute = 0;
  const setTime = (h: number, m: number, mer?: string) => {
    if (h > 23 || m > 59) return false;
    const w = mer ? normalizeAr(mer) : "";
    if (w) {
      const pm = /^(م|مساء|بالليل|بليل|العصر|المغرب|العشا)/.test(w) || w.startsWith("مساء");
      const noon = /الظهر|الضهر/.test(w);
      if (pm && h < 12) h += 12;
      else if (noon && h < 6) h += 12;
      else if (/^(ص|صباح|الصبح)/.test(w) && h === 12) h = 0;
    } else if (h >= 1 && h <= 7) h += 12; // Egyptian convention: "الساعة 5" means 5 PM
    hour = h; minute = m; hits.time = true;
  };
  take(new RegExp(`${B}(?:ال)?ساع${H}\\s*(\\d{1,2})(?:[:.](\\d{2}))?(?:\\s*و\\s*(نص|ربع|ثلث|تلت))?(?:\\s*${MERIDIEM})?${E}`), (m) => {
    let min = m[2] ? +m[2] : 0;
    if (m[3]) min = { نص: 30, ربع: 15, ثلث: 20, تلت: 20 }[m[3] as "نص"] ?? 0;
    return setTime(+m[1], min, m[4]);
  });
  if (hour === null) take(new RegExp(`${B}(\\d{1,2}):(\\d{2})(?:\\s*${MERIDIEM})?${E}`), (m) => setTime(+m[1], +m[2], m[3]));
  if (hour === null) take(new RegExp(`${B}(\\d{1,2})\\s*${MERIDIEM}${E}`), (m) => setTime(+m[1], 0, m[2]));

  // Date
  let day: Date | null = null;
  const today = startOfDay(now);
  const rel: [RegExp, () => Date][] = [
    [new RegExp(`${B}بعد\\s+(?:بكر${H}|غد)${E}`), () => addDays(today, 2)],
    [new RegExp(`${B}(?:بكر${H}|غدًا|غداً|غدوه|غدو${H})${E}`), () => addDays(today, 1)],
    [new RegExp(`${B}(?:النهارد${H}|اليوم|انهارده)${E}`), () => today],
    [new RegExp(`${B}(?:بعد\\s+${A}سبوع|ال${A}سبوع\\s+(?:الجاي|القادم|الجاي${H}))${E}`), () => addDays(today, 7)],
    [new RegExp(`${B}(?:بعد\\s+شهر|الشهر\\s+(?:الجاي|القادم))${E}`), () => addMonths(today, 1)],
  ];
  for (const [re, fn] of rel) { if (day) break; take(re, () => { day = fn(); hits.date = true; }); }
  if (!day) take(new RegExp(`${B}بعد\\s+(\\d{1,3})\\s*(يوم|${A}يام|${A}سبوع|${A}سابيع|شهر|شهور)${E}`), (m) => {
    const n = +m[1];
    const u = normalizeAr(m[2]);
    day = u.startsWith("شهر") || u.startsWith("شهو") ? addMonths(today, n) : u.includes("سب") ? addDays(today, n * 7) : addDays(today, n);
    hits.date = true;
  });
  if (!day) take(new RegExp(`${B}(?:يوم\\s+)?ال(سبت|${A}حد|${A}ثنين|${A}تنين|ثلاثاء|تلات|تلاتاء|${A}ربع|${A}ربعاء|خميس|جمع${H})${E}`), (m) => {
    const wd = WEEKDAYS.find(([re]) => re.test(m[1]))?.[1];
    if (wd === undefined) return false;
    let diff = (wd - today.getDay() + 7) % 7;
    if (diff === 0) diff = 7;
    day = addDays(today, diff);
    hits.date = true;
  });
  if (!day) take(/(?:^|\s)(\d{1,2})[/\-.](\d{1,2})(?:[/\-.](\d{2,4}))?(?=\s|$)/, (m) => {
    const d = +m[1], mo = +m[2] - 1;
    let y = m[3] ? +m[3] : today.getFullYear();
    if (y < 100) y += 2000;
    if (mo > 11 || d < 1 || d > 31) return false;
    let dt = new Date(y, mo, d);
    if (!m[3] && dt.getTime() < today.getTime() - 60 * 864e5) dt = new Date(y + 1, mo, d);
    day = dt;
    hits.date = true;
  });

  let dueAt: Date | null = null;
  let allDay = true;
  if (hour !== null) {
    const base = day ?? today;
    dueAt = new Date(base);
    dueAt.setHours(hour, minute, 0, 0);
    if (!day && dueAt.getTime() < now.getTime()) dueAt = addDays(dueAt, 1);
    allDay = false;
  } else if (day) {
    dueAt = day;
  }

  const title = orig.replace(/\s{2,}/g, " ").replace(/^[\s،,-]+|[\s،,-]+$/g, "").trim() || input.trim();
  return { title, dueAt, allDay, priority, categoryName, category, remind, hits };
}
