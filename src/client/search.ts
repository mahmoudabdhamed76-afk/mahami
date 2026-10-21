import { addDays, endOfDay, startOfDay, startOfWeek } from "./dates";
import { normalizeAr } from "./text";
import type { CategoryRec, SubtaskRec, TaskRec } from "@/lib/types";

export interface SearchFilters {
  overdue?: boolean;
  range?: "today" | "tomorrow" | "week" | "noDate";
  completed?: boolean;
  priority?: number;
  category?: string;
  reminder?: boolean;
}
export interface ParsedQuery { terms: string[]; filters: SearchFilters; chips: string[] }

const KW: [RegExp, (f: SearchFilters, chips: string[]) => void][] = [
  [/^متا?خر(ه|ات)?$/, (f, c) => { f.overdue = true; c.push("متأخرة"); }],
  [/^(اليوم|النهارده|انهارده)$/, (f, c) => { f.range = "today"; c.push("اليوم"); }],
  [/^(بكره|غدا|غدًا)$/, (f, c) => { f.range = "tomorrow"; c.push("غدًا"); }],
  [/^(الاسبوع|اسبوع)$/, (f, c) => { f.range = "week"; c.push("هذا الأسبوع"); }],
  [/^(مكتمل(ه|ات)?|منجز(ه|ات)?|خلصت|منتهي(ه)?)$/, (f, c) => { f.completed = true; c.push("مكتملة"); }],
  [/^(مفتوح(ه)?|نشط(ه)?|باقي(ه)?|حالي(ه)?)$/, (f, c) => { f.completed = false; c.push("غير مكتملة"); }],
  [/^(بتذكير|تذكير|منبه)$/, (f, c) => { f.reminder = true; c.push("بتذكير"); }],
  [/^(بدون|بلا)موعد$/, (f, c) => { f.range = "noDate"; c.push("بدون موعد"); }],
  [/^(عاجل(ه)?|مهم(ه)?)$/, (f, c) => { f.priority = 3; c.push("أولوية عالية"); }],
];

export function parseQuery(q: string): ParsedQuery {
  const filters: SearchFilters = {};
  const chips: string[] = [];
  const terms: string[] = [];
  const norm = normalizeAr(q).replace(/(بدون|بلا)\s+موعد/g, "$1موعد");
  for (const tok of norm.split(/\s+/).filter(Boolean)) {
    if (tok.startsWith("#") && tok.length > 1) { filters.category = tok.slice(1).replace(/_/g, " "); chips.push(`#${filters.category}`); continue; }
    const pm = /^!(عالي(ه)?|عاجل|متوسط(ه)?|منخفض(ه)?|!*)$/.exec(tok);
    if (pm) {
      const p = /عال|عاجل/.test(tok) ? 3 : /متوسط/.test(tok) ? 2 : /منخفض/.test(tok) ? 1 : Math.min(tok.length, 3);
      filters.priority = p; chips.push(["", "منخفضة", "متوسطة", "عالية"][p]); continue;
    }
    const kw = KW.find(([re]) => re.test(tok));
    if (kw) kw[1](filters, chips);
    else terms.push(tok);
  }
  return { terms, filters, chips };
}

export function searchTasks(
  q: string,
  tasks: TaskRec[],
  subtasks: Record<string, SubtaskRec[]>,
  categories: Record<string, CategoryRec>,
  weekStart: number,
  now = new Date(),
) {
  const { terms, filters } = parseQuery(q);
  const t0 = startOfDay(now).getTime();
  const out: { task: TaskRec; score: number }[] = [];
  for (const t of tasks) {
    const due = t.dueAt ? Date.parse(t.dueAt) : null;
    if (filters.completed !== undefined && t.completed !== filters.completed) continue;
    if (filters.overdue && (t.completed || due === null || due >= (t.allDay ? t0 : now.getTime()))) continue;
    if (filters.priority && t.priority !== filters.priority) continue;
    if (filters.reminder && !t.remindAt) continue;
    if (filters.range) {
      if (filters.range === "noDate") { if (due !== null) continue; }
      else {
        if (due === null) continue;
        const [a, b] =
          filters.range === "today" ? [t0, endOfDay(now).getTime()]
          : filters.range === "tomorrow" ? [addDays(t0, 1).getTime(), endOfDay(addDays(now, 1)).getTime()]
          : [startOfWeek(now, weekStart).getTime(), addDays(startOfWeek(now, weekStart), 7).getTime() - 1];
        if (due < a || due > b) continue;
      }
    }
    const cat = t.categoryId ? categories[t.categoryId] : undefined;
    if (filters.category) {
      if (!cat) continue;
      const cn = normalizeAr(cat.name);
      if (!cn.includes(filters.category) && !cn.replace(/^ال/, "").includes(filters.category.replace(/^ال/, ""))) continue;
    }
    let score = 0;
    if (terms.length) {
      const title = normalizeAr(t.title);
      const rest = normalizeAr([t.notes ?? "", cat?.name ?? "", ...(subtasks[t.id] ?? []).map((s) => s.title)].join(" "));
      let all = true;
      for (const term of terms) {
        if (title.startsWith(term)) score += 30;
        else if (title.includes(term)) score += 20;
        else if (rest.includes(term)) score += 5;
        else { all = false; break; }
      }
      if (!all) continue;
    }
    if (!t.completed) score += 3;
    out.push({ task: t, score });
  }
  return out
    .sort((a, b) => b.score - a.score || (Date.parse(a.task.dueAt ?? "9999") - Date.parse(b.task.dueAt ?? "9999")))
    .map((x) => x.task);
}
