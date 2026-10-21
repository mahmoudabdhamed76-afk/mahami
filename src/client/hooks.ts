"use client";
import { useEffect, useMemo, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { useStore } from "./store";
import { addDays, endOfDay, startOfDay, startOfWeek } from "./dates";
import type { CategoryRec, SubtaskRec, TaskRec } from "@/lib/types";
import type { SmartList } from "./ui";

/** Re-renders every `ms` so relative dates/overdue states stay fresh. */
export function useNow(ms = 60_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms);
    const vis = () => document.visibilityState === "visible" && setNow(Date.now());
    document.addEventListener("visibilitychange", vis);
    return () => { clearInterval(id); document.removeEventListener("visibilitychange", vis); };
  }, [ms]);
  return now;
}

export function useTasks() {
  const tasks = useStore((s) => s.tasks);
  return useMemo(() => Object.values(tasks), [tasks]);
}

export function useCategories(): CategoryRec[] {
  const cats = useStore((s) => s.categories);
  return useMemo(() => Object.values(cats).sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt)), [cats]);
}

export function useSubtasksByTask() {
  const subs = useStore((s) => s.subtasks);
  return useMemo(() => {
    const m: Record<string, SubtaskRec[]> = {};
    for (const s of Object.values(subs)) (m[s.taskId] ??= []).push(s);
    for (const k in m) m[k].sort((a, b) => a.sortOrder - b.sortOrder);
    return m;
  }, [subs]);
}

export const isOverdue = (t: TaskRec, now: number) => {
  if (t.completed || !t.dueAt) return false;
  const due = Date.parse(t.dueAt);
  return t.allDay ? due < startOfDay(now).getTime() : due < now;
};

export const isDueToday = (t: TaskRec, now: number) =>
  !!t.dueAt && Date.parse(t.dueAt) >= startOfDay(now).getTime() && Date.parse(t.dueAt) <= endOfDay(now).getTime();

export function sortTasks(list: TaskRec[], by: "due" | "priority" | "created" | "title" | "manual" = "due") {
  const due = (t: TaskRec) => (t.dueAt ? Date.parse(t.dueAt) + (t.allDay ? 0.5 : 0) : Infinity);
  const cmp: Record<string, (a: TaskRec, b: TaskRec) => number> = {
    due: (a, b) => due(a) - due(b) || b.priority - a.priority || a.sortOrder - b.sortOrder,
    priority: (a, b) => b.priority - a.priority || due(a) - due(b),
    created: (a, b) => b.createdAt.localeCompare(a.createdAt),
    title: (a, b) => a.title.localeCompare(b.title, "ar"),
    manual: (a, b) => a.sortOrder - b.sortOrder,
  };
  return [...list].sort(cmp[by]);
}

export function matchesSmart(list: SmartList, t: TaskRec, now: number) {
  switch (list) {
    case "today": return !t.completed && (isDueToday(t, now) || isOverdue(t, now));
    case "scheduled": return !t.completed && !!t.dueAt;
    case "all": return !t.completed;
    case "important": return !t.completed && t.priority === 3;
    case "overdue": return isOverdue(t, now);
    case "completed": return t.completed;
    case "nodate": return !t.completed && !t.dueAt;
  }
}

export function useSmartCounts(now: number) {
  const tasks = useTasks();
  return useMemo(() => {
    const c: Record<SmartList, number> = { today: 0, scheduled: 0, all: 0, important: 0, overdue: 0, completed: 0, nodate: 0 };
    for (const t of tasks) for (const k of Object.keys(c) as SmartList[]) if (matchesSmart(k, t, now)) c[k]++;
    return c;
  }, [tasks, now]);
}

export function useCategoryCounts() {
  const tasks = useTasks();
  return useMemo(() => {
    const m: Record<string, { active: number; done: number }> = {};
    for (const t of tasks) {
      if (!t.categoryId) continue;
      const e = (m[t.categoryId] ??= { active: 0, done: 0 });
      if (t.completed) e.done++; else e.active++;
    }
    return m;
  }, [tasks]);
}

export type Bucket = { key: string; title: string; tasks: TaskRec[]; tone?: "danger" };

/** Groups active tasks into iOS-style date sections. */
export function bucketByDate(tasks: TaskRec[], now: number, weekStart: number, relDay: (d: Date) => string): Bucket[] {
  const today = startOfDay(now).getTime();
  const tomorrow = addDays(today, 1).getTime();
  const after = addDays(today, 2).getTime();
  const weekEnd = addDays(startOfWeek(now, weekStart), 7).getTime();
  const b: Record<string, Bucket> = {
    overdue: { key: "overdue", title: "متأخرة", tasks: [], tone: "danger" },
    today: { key: "today", title: "اليوم", tasks: [] },
    tomorrow: { key: "tomorrow", title: "غدًا", tasks: [] },
    week: { key: "week", title: "بقية الأسبوع", tasks: [] },
    later: { key: "later", title: "لاحقًا", tasks: [] },
    none: { key: "none", title: "بدون موعد", tasks: [] },
  };
  for (const t of tasks) {
    if (!t.dueAt) { b.none.tasks.push(t); continue; }
    const d = Date.parse(t.dueAt);
    if (isOverdue(t, now)) b.overdue.tasks.push(t);
    else if (d < tomorrow) b.today.tasks.push(t);
    else if (d < after) b.tomorrow.tasks.push(t);
    else if (d < weekEnd) b.week.tasks.push(t);
    else b.later.tasks.push(t);
  }
  void relDay;
  return Object.values(b).filter((x) => x.tasks.length).map((x) => ({ ...x, tasks: sortTasks(x.tasks) }));
}

export { useShallow };
