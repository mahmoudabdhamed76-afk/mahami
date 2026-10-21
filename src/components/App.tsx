"use client";
import { AnimatePresence, motion } from "motion/react";
import { useEffect } from "react";
import { scheduleLocalReminders, registerSW } from "@/client/notifications";
import { useStore } from "@/client/store";
import { boot } from "@/client/sync";
import { installHistory, useUI, type Tab } from "@/client/ui";
import { useTasks } from "@/client/hooks";
import { Sidebar, TabBar } from "./Navigation";
import { ConfirmSheet, Toasts } from "./ui/Overlays";
import { QuickAdd } from "./tasks/QuickAdd";
import { TaskEditor } from "./tasks/TaskEditor";
import { CategoryEditor } from "./CategoryEditor";
import { AuthView } from "./views/AuthView";
import { TodayView } from "./views/TodayView";
import { ListsView } from "./views/ListsView";
import { ListView } from "./views/ListView";
import { CalendarView } from "./views/CalendarView";
import { StatsView } from "./views/StatsView";
import { SettingsView } from "./views/SettingsView";

const ROOTS: Record<Tab, () => React.ReactElement> = {
  today: TodayView, lists: ListsView, calendar: CalendarView, stats: StatsView, settings: SettingsView,
};

function useTheme() {
  const theme = useStore((s) => s.settings.theme);
  const accent = useStore((s) => s.settings.accent);
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.accent = accent;
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const dark = theme === "dark" || (theme === "system" && mq.matches);
      root.classList.toggle("dark", dark);
      document.querySelector('meta[name="theme-color"]:not([media])')?.remove();
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [theme, accent]);
}

function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.metaKey || e.ctrlKey || e.altKey || t.closest("input,textarea,select,[contenteditable]")) return;
      const ui = useUI.getState();
      if (ui.editor || ui.quickAdd || ui.categoryEditor) return;
      if (e.key === "n" || e.key === "N" || e.key === "ى") { e.preventDefault(); ui.newTask(ui.ctxDraft); }
      else if (e.key === "/") { e.preventDefault(); ui.setTab("lists"); ui.setSearch(true); }
      else if (e.key >= "1" && e.key <= "5") ui.setTab((["today", "lists", "calendar", "stats", "settings"] as Tab[])[Number(e.key) - 1]);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}

function useReminders() {
  const tasks = useTasks();
  const phase = useStore((s) => s.phase);
  useEffect(() => {
    if (phase !== "app") return;
    const id = setTimeout(() => scheduleLocalReminders(tasks), 400);
    return () => clearTimeout(id);
  }, [tasks, phase]);
}

export default function App() {
  const phase = useStore((s) => s.phase);
  useTheme();
  useShortcuts();
  useReminders();

  useEffect(() => {
    installHistory();
    void boot();
    void registerSW();
    const p = new URLSearchParams(location.search);
    const tab = p.get("tab") as Tab | null;
    if (tab && tab in ROOTS) useUI.setState({ tab });
    const unsub = useStore.subscribe((s, prev) => {
      if (s.phase === "app" && prev.phase !== "app") {
        const task = p.get("task");
        if (task) setTimeout(() => useUI.getState().openTask(task), 300);
        if (p.get("new")) setTimeout(() => useUI.getState().newTask(), 300);
        if (p.size) history.replaceState(history.state, "", "/");
      }
    });
    const open = (e: Event) => useUI.getState().openTask((e as CustomEvent<string>).detail);
    window.addEventListener("mh:open-task", open);
    return () => { unsub(); window.removeEventListener("mh:open-task", open); };
  }, []);

  return (
    <div className="relative flex h-dvh overflow-hidden">
      <div className="ambient" aria-hidden><span /><span /><span /><span /></div>
      {phase === "boot" ? (
        <div className="relative z-10 grid flex-1 place-items-center">
          <motion.img src="/icons/icon-192.png" alt="مهامي" className="size-20 rounded-[22px]" animate={{ scale: [0.96, 1.02, 0.96] }} transition={{ repeat: Infinity, duration: 1.6 }} />
        </div>
      ) : phase === "auth" ? (
        <div className="relative z-10 flex-1"><AuthView /></div>
      ) : (
        <>
          <Sidebar />
          <main className="relative z-10 min-w-0 flex-1"><Screens /></main>
          <TabBar />
          <QuickAdd />
          <TaskEditor />
          <CategoryEditor />
        </>
      )}
      <ConfirmSheet />
      <Toasts />
    </div>
  );
}

const pushSpring = { type: "spring", stiffness: 380, damping: 40, mass: 0.9 } as const;

function Screens() {
  const tab = useUI((s) => s.tab);
  const stack = useUI((s) => s.stack);
  const Root = ROOTS[tab];
  const top = stack.length;
  return (
    <AnimatePresence initial={false} mode="popLayout">
      <motion.div key={tab} className="absolute inset-0"
        initial={{ opacity: 0, scale: 0.985 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}>
        {/* Root stays mounted under pushed pages to keep its scroll position */}
        <motion.div className="absolute inset-0" animate={{ x: top ? "22%" : 0, opacity: top ? 0 : 1 }} transition={pushSpring} aria-hidden={top > 0} inert={top > 0}>
          <Root />
        </motion.div>
        <AnimatePresence initial={false}>
          {stack.map((r, i) => (
            <motion.div key={`${i}-${r.list}`} className="absolute inset-0"
              initial={{ x: "-100%", opacity: 0.6 }} animate={{ x: i + 1 === top ? 0 : "22%", opacity: i + 1 === top ? 1 : 0 }} exit={{ x: "-100%", opacity: 0.4 }}
              transition={pushSpring} inert={i + 1 !== top}>
              <ListView route={r} />
            </motion.div>
          ))}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  );
}
