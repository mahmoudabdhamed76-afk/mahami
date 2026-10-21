"use client";
import { create } from "zustand";
import type { CategoryRec, NoteRec, SubtaskRec, TaskRec, UserDTO, UserSettings } from "@/lib/types";

export type Settings = Required<UserSettings>;
export const DEFAULT_SETTINGS: Settings = {
  theme: "system",
  accent: "blue",
  digits: "arab",
  weekStart: 6,
  autoRemind: true,
  defaultReminderTime: "09:00",
};

export type SyncState = "idle" | "syncing" | "offline" | "error";

export interface Toast {
  id: number;
  text: string;
  tone?: "default" | "success" | "error";
  action?: { label: string; run: () => void };
  icon?: "bell" | "check" | "trash" | "wifi-off" | "cloud";
}

type Entity = "categories" | "tasks" | "subtasks" | "notes";
type RecOf<E extends Entity> = E extends "categories" ? CategoryRec : E extends "tasks" ? TaskRec : E extends "notes" ? NoteRec : SubtaskRec;

interface State {
  phase: "boot" | "auth" | "app";
  user: UserDTO | null;
  categories: Record<string, CategoryRec>;
  tasks: Record<string, TaskRec>;
  subtasks: Record<string, SubtaskRec>;
  notes: Record<string, NoteRec>;
  settings: Settings;
  sync: { state: SyncState; pending: number; last: number | null; error?: string };
  online: boolean;
  toasts: Toast[];

  setPhase(p: State["phase"]): void;
  setUser(u: UserDTO | null): void;
  hydrate(d: { categories: CategoryRec[]; tasks: TaskRec[]; subtasks: SubtaskRec[]; notes: NoteRec[] }): void;
  apply<E extends Entity>(entity: E, put: RecOf<E>[], remove?: string[]): void;
  setSettings(patch: Partial<Settings>): void;
  setSync(patch: Partial<State["sync"]>): void;
  setOnline(v: boolean): void;
  toast(t: Omit<Toast, "id">, ms?: number): void;
  dismissToast(id: number): void;
  reset(): void;
}

const byId = <T extends { id: string }>(list: T[]) => Object.fromEntries(list.map((x) => [x.id, x])) as Record<string, T>;

function loadSettings(): Settings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try { return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem("mh_settings") || "{}") }; } catch { return DEFAULT_SETTINGS; }
}

let toastSeq = 0;

export const useStore = create<State>((set, get) => ({
  phase: "boot",
  user: null,
  categories: {},
  tasks: {},
  subtasks: {},
  notes: {},
  settings: loadSettings(),
  sync: { state: "idle", pending: 0, last: null },
  online: typeof navigator === "undefined" ? true : navigator.onLine,
  toasts: [],

  setPhase: (phase) => set({ phase }),
  setUser: (user) => set({ user }),
  hydrate: (d) => set({ categories: byId(d.categories), tasks: byId(d.tasks), subtasks: byId(d.subtasks), notes: byId(d.notes) }),
  apply: (entity, put, remove = []) => {
    if (!put.length && !remove.length) return;
    const next = { ...(get()[entity] as Record<string, RecOf<typeof entity>>) };
    for (const r of put) next[r.id] = r;
    for (const id of remove) delete next[id];
    set({ [entity]: next } as Partial<State>);
  },
  setSettings: (patch) => {
    const settings = { ...get().settings, ...patch };
    try { localStorage.setItem("mh_settings", JSON.stringify(settings)); } catch { /* private mode */ }
    set({ settings });
  },
  setSync: (patch) => set({ sync: { ...get().sync, ...patch } }),
  setOnline: (online) => set({ online }),
  toast: (t, ms = 3800) => {
    const id = ++toastSeq;
    set({ toasts: [...get().toasts.slice(-2), { ...t, id }] });
    setTimeout(() => get().dismissToast(id), ms);
  },
  dismissToast: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
  reset: () => set({ user: null, categories: {}, tasks: {}, subtasks: {}, notes: {}, sync: { state: "idle", pending: 0, last: null } }),
}));

export const getState = () => useStore.getState();
