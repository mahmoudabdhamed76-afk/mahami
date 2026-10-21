"use client";
import { motion } from "motion/react";
import { BarChart3, CalendarDays, ListChecks, Plus, Settings, Sun, Search } from "lucide-react";
import { useUI, type Tab } from "@/client/ui";
import { useStore } from "@/client/store";
import { useCategories, useCategoryCounts, useNow, useSmartCounts } from "@/client/hooks";
import { useFmt } from "@/client/format";
import { CategoryIcon } from "./ui/icons";
import { cx, Press, spring } from "./ui/primitives";
import { SyncBadge } from "./SyncBadge";

export const TABS: { id: Tab; label: string; icon: typeof Sun }[] = [
  { id: "today", label: "اليوم", icon: Sun },
  { id: "lists", label: "المهام", icon: ListChecks },
  { id: "calendar", label: "التقويم", icon: CalendarDays },
  { id: "stats", label: "الإحصائيات", icon: BarChart3 },
  { id: "settings", label: "الإعدادات", icon: Settings },
];

/** Floating liquid-glass tab bar (phones/tablets). */
export function TabBar() {
  const tab = useUI((s) => s.tab);
  const setTab = useUI((s) => s.setTab);
  const newTask = useUI((s) => s.newTask);
  const now = useNow();
  const today = useSmartCounts(now).today;
  const fmt = useFmt();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 flex items-end justify-center gap-2.5 px-3 pb-[max(env(safe-area-inset-bottom),10px)] lg:hidden" aria-label="التنقل الرئيسي">
      <div className="glass-strong flex h-[62px] flex-1 items-center justify-around rounded-full px-1.5 sm:max-w-md">
        {TABS.map((t) => {
          const active = tab === t.id;
          const I = t.icon;
          return (
            <button key={t.id} type="button" onClick={() => setTab(t.id)} aria-current={active ? "page" : undefined}
              className="relative flex h-[54px] flex-1 flex-col items-center justify-center gap-0.5 rounded-full">
              {active && <motion.span layoutId="tab-lens" transition={spring} className="absolute inset-0 rounded-full bg-fill shadow-[inset_0_1px_0_var(--glass-hi)]" />}
              <span className="relative">
                <I size={23} strokeWidth={active ? 2.4 : 2} className={active ? "text-accent" : "text-label"} />
                {t.id === "today" && today > 0 && (
                  <span className="absolute -end-2.5 -top-1.5 min-w-[17px] rounded-full bg-ios-red px-1 text-center text-[10px] font-bold leading-[17px] text-white num">{fmt.num(today)}</span>
                )}
              </span>
              <span className={cx("relative text-[10.5px] font-semibold", active ? "text-accent" : "text-label")}>{t.label}</span>
            </button>
          );
        })}
      </div>
      <Press onClick={() => newTask(useUI.getState().ctxDraft)} scale={0.9} aria-label="مهمة جديدة"
        className="glass-pill grid size-[62px] shrink-0 place-items-center rounded-full text-white">
        <Plus size={30} strokeWidth={2.4} />
      </Press>
    </nav>
  );
}

/** Desktop sidebar */
export function Sidebar() {
  const tab = useUI((s) => s.tab);
  const setTab = useUI((s) => s.setTab);
  const newTask = useUI((s) => s.newTask);
  const setSearch = useUI((s) => s.setSearch);
  const user = useStore((s) => s.user);
  const cats = useCategories();
  const counts = useCategoryCounts();
  const now = useNow();
  const smart = useSmartCounts(now);
  const fmt = useFmt();
  const openList = (list: `cat:${string}`) => {
    useUI.setState({ tab: "lists", stack: [] });
    useUI.getState().push({ name: "list", list });
  };
  return (
    <aside className="glass-strong relative z-30 m-3 me-0 hidden w-[272px] shrink-0 flex-col rounded-[28px] lg:flex">
      <div className="flex items-center gap-3 px-5 pb-3 pt-5">
        <img src="/icons/icon-192.png" alt="" className="size-10 rounded-[11px] shadow-md" />
        <div className="min-w-0">
          <p className="t-headline">مهامي</p>
          <p className="truncate t-cap text-label-2">{user?.name}</p>
        </div>
      </div>
      <div className="px-3">
        <button type="button" onClick={() => { setTab("lists"); setSearch(true); }}
          className="flex h-10 w-full items-center gap-2 rounded-xl bg-fill px-3 t-sub text-label-2">
          <Search size={17} /> بحث ذكي
          <kbd className="ms-auto rounded-md bg-fill px-1.5 t-cap">/</kbd>
        </button>
      </div>
      <nav className="mt-3 space-y-0.5 px-3" aria-label="التنقل الرئيسي">
        {TABS.map((t) => {
          const active = tab === t.id;
          const I = t.icon;
          return (
            <button key={t.id} type="button" onClick={() => setTab(t.id)} aria-current={active ? "page" : undefined}
              className="relative flex h-11 w-full items-center gap-3 rounded-xl px-3 t-callout">
              {active && <motion.span layoutId="side-lens" transition={spring} className="absolute inset-0 rounded-xl bg-[rgb(var(--accent-rgb)/0.13)]" />}
              <I size={20} className={cx("relative", active ? "text-accent" : "text-label-2")} />
              <span className={cx("relative", active && "font-semibold text-accent")}>{t.label}</span>
              {t.id === "today" && smart.today > 0 && <span className="relative ms-auto t-foot text-label-2 num">{fmt.num(smart.today)}</span>}
            </button>
          );
        })}
      </nav>
      <p className="mt-5 px-6 pb-1 t-foot font-semibold text-label-2">قوائمي</p>
      <div className="scroll-y min-h-0 flex-1 space-y-0.5 px-3">
        {cats.map((c) => (
          <button key={c.id} type="button" onClick={() => openList(`cat:${c.id}`)} className="flex h-10 w-full items-center gap-3 rounded-xl px-3 t-sub hover:bg-fill">
            <CategoryIcon icon={c.icon} color={c.color} size={24} />
            <span className="truncate">{c.name}</span>
            <span className="ms-auto t-foot text-label-2 num">{fmt.num(counts[c.id]?.active ?? 0)}</span>
          </button>
        ))}
      </div>
      <div className="space-y-2 p-3">
        <Press onClick={() => newTask(useUI.getState().ctxDraft)} className="glass-pill flex h-11 w-full items-center justify-center gap-2 rounded-2xl t-callout font-semibold text-white">
          <Plus size={20} /> مهمة جديدة
          <kbd className="rounded-md bg-white/20 px-1.5 t-cap">N</kbd>
        </Press>
        <div className="flex justify-center"><SyncBadge /></div>
      </div>
    </aside>
  );
}
