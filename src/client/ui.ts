"use client";
import { create } from "zustand";
import type { TaskRec } from "@/lib/types";

export type Tab = "today" | "lists" | "notes" | "calendar" | "stats" | "settings";
export type SmartList = "today" | "scheduled" | "all" | "important" | "overdue" | "completed" | "nodate";
export type Route = { name: "list"; list: SmartList | `cat:${string}` };

export type TaskDraft = Partial<Pick<TaskRec, "title" | "dueAt" | "allDay" | "categoryId" | "priority" | "notes" | "reminderOffset">>;

export interface ConfirmOpts {
  title: string;
  message?: string;
  confirm: string;
  destructive?: boolean;
  resolve: (ok: boolean) => void;
}

interface UI {
  tab: Tab;
  stack: Route[];
  dir: 1 | -1;
  editor: { id?: string; draft?: TaskDraft } | null;
  quickAdd: { draft?: TaskDraft } | null;
  categoryEditor: { id?: string } | null;
  noteEditor: { id?: string; autoRecord?: boolean } | null;
  confirmState: Omit<ConfirmOpts, "resolve"> & { resolve: (ok: boolean) => void } | null;
  searchOpen: boolean;
  /** Defaults for the global + button, provided by the visible screen */
  ctxDraft: TaskDraft | undefined;

  setTab(t: Tab): void;
  push(r: Route): void;
  pop(): void;
  openTask(id: string): void;
  newTask(draft?: TaskDraft, full?: boolean): void;
  closeEditor(): void;
  closeQuickAdd(): void;
  editCategory(id?: string): void;
  closeCategory(): void;
  openNote(id?: string, autoRecord?: boolean): void;
  closeNote(): void;
  setSearch(v: boolean): void;
}

// Next.js reloads the page on popstate into an entry without its internal
// markers (__NA…), so every entry we write carries the current state forward.
const pushEntry = (mh: unknown) => history.pushState({ ...(history.state ?? {}), mh }, "");

// Sheets get their own history entry so the Android/browser back button closes them.
function sheetEntry() {
  if (typeof history !== "undefined" && history.state?.mh !== "sheet") pushEntry("sheet");
}
function closeSheet(apply: () => void) {
  if (typeof history !== "undefined" && history.state?.mh === "sheet") history.back(); // popstate applies the close
  else apply();
}

export const useUI = create<UI>((set, get) => ({
  tab: "today",
  stack: [],
  dir: 1,
  editor: null,
  quickAdd: null,
  categoryEditor: null,
  noteEditor: null,
  confirmState: null,
  searchOpen: false,
  ctxDraft: undefined,

  setTab: (tab) => {
    if (tab === get().tab) {
      // iOS: tapping the active tab pops to root
      if (get().stack.length) { set({ stack: [], dir: -1 }); }
      return;
    }
    set({ tab, stack: [], dir: 1, searchOpen: false });
  },
  push: (r) => {
    pushEntry(get().stack.length + 1);
    set({ stack: [...get().stack, r], dir: 1 });
  },
  pop: () => {
    if (get().stack.length) history.back();
  },
  openTask: (id) => { sheetEntry(); set({ editor: { id }, quickAdd: null }); },
  newTask: (draft, full) => { sheetEntry(); full ? set({ editor: { draft }, quickAdd: null }) : set({ quickAdd: { draft } }); },
  closeEditor: () => closeSheet(() => set({ editor: null })),
  closeQuickAdd: () => closeSheet(() => set({ quickAdd: null })),
  editCategory: (id) => { sheetEntry(); set({ categoryEditor: { id } }); },
  closeCategory: () => closeSheet(() => set({ categoryEditor: null })),
  openNote: (id, autoRecord) => { sheetEntry(); set({ noteEditor: { id, autoRecord } }); },
  closeNote: () => closeSheet(() => set({ noteEditor: null })),
  setSearch: (searchOpen) => set({ searchOpen }),
}));

/** Browser back button / swipe-back pops our in-app navigation stack. */
export function installHistory() {
  if (history.state?.mh === undefined) history.replaceState({ ...(history.state ?? {}), mh: 0 }, "");
  window.addEventListener("popstate", () => {
    const s = useUI.getState();
    if (s.confirmState) { s.confirmState.resolve(false); return; }
    if (s.categoryEditor) { useUI.setState({ categoryEditor: null }); return; }
    if (s.noteEditor) { useUI.setState({ noteEditor: null }); return; }
    if (s.editor) { useUI.setState({ editor: null }); return; }
    if (s.quickAdd) { useUI.setState({ quickAdd: null }); return; }
    if (s.stack.length) useUI.setState({ stack: s.stack.slice(0, -1), dir: -1 });
  });
}

export function confirmDialog(o: Omit<ConfirmOpts, "resolve">) {
  return new Promise<boolean>((resolve) => {
    useUI.setState({ confirmState: { ...o, resolve: (ok) => { useUI.setState({ confirmState: null }); resolve(ok); } } });
  });
}

import { useEffect } from "react";
/** Screens call this so the global + button pre-fills sensible defaults. */
export function useContextDraft(draft: TaskDraft | undefined, deps: unknown[]) {
  useEffect(() => {
    useUI.setState({ ctxDraft: draft });
    return () => useUI.setState({ ctxDraft: undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
