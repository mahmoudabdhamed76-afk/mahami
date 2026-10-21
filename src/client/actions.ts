"use client";
import { commit } from "./sync";
import { putRecords } from "./idb";
import { getState } from "./store";
import { uid } from "./uid";
import type { CategoryRec, SubtaskRec, TaskRec } from "@/lib/types";

const now = () => new Date().toISOString();

/** Keep derived task fields consistent (reminder offset, completion time). */
export function normalizeTask(t: TaskRec): TaskRec {
  const out = { ...t };
  if (out.reminderOffset != null) {
    out.remindAt = out.dueAt ? new Date(Date.parse(out.dueAt) - out.reminderOffset * 60_000).toISOString() : null;
    if (!out.dueAt) out.reminderOffset = null;
  }
  if (out.completed && !out.completedAt) out.completedAt = now();
  if (!out.completed) out.completedAt = null;
  return out;
}

/** Default reminder for a new task when "auto remind" is on. */
export function defaultReminder(dueAt: string | null, allDay: boolean): number | null {
  const s = getState().settings;
  if (!s.autoRemind || !dueAt) return null;
  if (!allDay) return 0;
  const [h, m] = s.defaultReminderTime.split(":").map(Number);
  return -(h * 60 + m); // minutes after local midnight
}

export type TaskInput = Partial<Omit<TaskRec, "id" | "createdAt" | "updatedAt" | "deletedAt">> & { title: string };

export function createTask(input: TaskInput, subtaskTitles: string[] = []) {
  const ts = now();
  const tasks = Object.values(getState().tasks);
  const minOrder = tasks.reduce((m, t) => Math.min(m, t.sortOrder), 0);
  const allDay = input.allDay ?? true;
  const dueAt = input.dueAt ?? null;
  const auto = input.reminderOffset === undefined;
  let task = normalizeTask({
    id: uid(), title: input.title.trim(), notes: input.notes ?? null, priority: input.priority ?? 0,
    categoryId: input.categoryId ?? null, dueAt, allDay,
    remindAt: input.remindAt ?? null,
    reminderOffset: input.reminderOffset !== undefined ? input.reminderOffset : defaultReminder(dueAt, allDay),
    completed: false, completedAt: null, sortOrder: minOrder - 1,
    createdAt: ts, updatedAt: ts, deletedAt: null,
  });
  if (auto && task.remindAt && Date.parse(task.remindAt) < Date.now()) task = { ...task, remindAt: null, reminderOffset: null };
  void commit("task", [task]);
  if (subtaskTitles.length) {
    const subs = subtaskTitles.filter((s) => s.trim()).map((title, i) => ({
      id: uid(), taskId: task.id, title: title.trim(), done: false, sortOrder: i, createdAt: ts, updatedAt: ts, deletedAt: null,
    }));
    void commit("subtask", subs);
  }
  return task;
}

export function updateTask(id: string, patch: Partial<TaskRec>) {
  const cur = getState().tasks[id];
  if (!cur) return;
  const next = normalizeTask({ ...cur, ...patch, updatedAt: now() });
  void commit("task", [next]);
  return next;
}

export function toggleTask(id: string) {
  const cur = getState().tasks[id];
  if (!cur) return;
  if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate?.(cur.completed ? 5 : [8, 30, 12]);
  return updateTask(id, { completed: !cur.completed, completedAt: cur.completed ? null : now() });
}

export function deleteTask(id: string) {
  const st = getState();
  const task = st.tasks[id];
  if (!task) return null;
  const subs = Object.values(st.subtasks).filter((s) => s.taskId === id);
  const ts = now();
  st.apply("subtasks", [], subs.map((s) => s.id)); // server cascades; mirror locally
  void putRecords("subtasks", [], subs.map((s) => s.id));
  void commit("task", [], [{ id, ts }]);
  return { task, subs };
}

export function restoreTask(snap: { task: TaskRec; subs: SubtaskRec[] }) {
  const ts = now();
  void commit("task", [{ ...snap.task, updatedAt: ts, deletedAt: null }]);
  if (snap.subs.length) void commit("subtask", snap.subs.map((s) => ({ ...s, updatedAt: ts, deletedAt: null })));
}

// ── Subtasks ────────────────────────────────────────────────────────────────
export function addSubtask(taskId: string, title: string) {
  const ts = now();
  const siblings = Object.values(getState().subtasks).filter((s) => s.taskId === taskId);
  const sub: SubtaskRec = {
    id: uid(), taskId, title: title.trim(), done: false,
    sortOrder: siblings.reduce((m, s) => Math.max(m, s.sortOrder), -1) + 1, createdAt: ts, updatedAt: ts, deletedAt: null,
  };
  void commit("subtask", [sub]);
  return sub;
}
export function updateSubtask(id: string, patch: Partial<SubtaskRec>) {
  const cur = getState().subtasks[id];
  if (cur) void commit("subtask", [{ ...cur, ...patch, updatedAt: now() }]);
}
export function deleteSubtask(id: string) {
  void commit("subtask", [], [{ id, ts: now() }]);
}

// ── Categories ──────────────────────────────────────────────────────────────
export function createCategory(input: { name: string; color: string; icon: string }) {
  const ts = now();
  const max = Object.values(getState().categories).reduce((m, c) => Math.max(m, c.sortOrder), -1);
  const cat: CategoryRec = { id: uid(), ...input, name: input.name.trim(), sortOrder: max + 1, createdAt: ts, updatedAt: ts, deletedAt: null };
  void commit("category", [cat]);
  return cat;
}
export function updateCategory(id: string, patch: Partial<CategoryRec>) {
  const cur = getState().categories[id];
  if (cur) void commit("category", [{ ...cur, ...patch, updatedAt: now() }]);
}
export function deleteCategory(id: string) {
  const st = getState();
  const ts = now();
  // Mirror server behaviour: tasks lose the category (no new op needed, server does it)
  const affected = Object.values(st.tasks).filter((t) => t.categoryId === id).map((t) => ({ ...t, categoryId: null }));
  st.apply("tasks", affected);
  void putRecords("tasks", affected);
  void commit("category", [], [{ id, ts }]);
}
