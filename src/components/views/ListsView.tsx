"use client";
import { AnimatePresence, motion } from "motion/react";
import { AlarmClock, CalendarDays, CheckCircle2, ChevronLeft, Flag, Inbox, Plus, Search, Sun, X, SearchX } from "lucide-react";
import { useDeferredValue, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useFmt } from "@/client/format";
import { useCategories, useCategoryCounts, useNow, useSmartCounts, useSubtasksByTask, useTasks } from "@/client/hooks";
import { parseQuery, searchTasks } from "@/client/search";
import { useStore } from "@/client/store";
import { useUI, type SmartList } from "@/client/ui";
import { CategoryIcon } from "../ui/icons";
import { EmptyState, Press } from "../ui/primitives";
import { Page } from "../ui/Page";
import { TaskGroup } from "../tasks/TaskRow";
import { SyncBadge } from "../SyncBadge";

export const SMART: Record<SmartList, { label: string; icon: typeof Sun; color: string }> = {
  today: { label: "اليوم", icon: Sun, color: "#007AFF" },
  scheduled: { label: "المجدولة", icon: CalendarDays, color: "#FF3B30" },
  all: { label: "الكل", icon: Inbox, color: "#636366" },
  important: { label: "المهمة", icon: Flag, color: "#FF9500" },
  overdue: { label: "المتأخرة", icon: AlarmClock, color: "#AF52DE" },
  completed: { label: "المكتملة", icon: CheckCircle2, color: "#34C759" },
  nodate: { label: "بدون موعد", icon: Inbox, color: "#30B0C7" },
};
const GRID: SmartList[] = ["today", "scheduled", "all", "important", "overdue", "completed"];

export function ListsView() {
  const now = useNow();
  const fmt = useFmt();
  const counts = useSmartCounts(now);
  const cats = useCategories();
  const catCounts = useCategoryCounts();
  const push = useUI((s) => s.push);
  const editCategory = useUI((s) => s.editCategory);
  const searchOpen = useUI((s) => s.searchOpen);
  const setSearch = useUI((s) => s.setSearch);
  const [q, setQ] = useState("");
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => { if (searchOpen) setTimeout(() => input.current?.focus(), 60); }, [searchOpen]);
  const searching = searchOpen || q.length > 0;

  const searchBar = (
    <div className="mb-4 flex items-center gap-2">
      <label className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-xl bg-fill px-3 text-label-2">
        <Search size={18} />
        <input
          ref={input} value={q} onChange={(e) => setQ(e.target.value)} onFocus={() => setSearch(true)}
          placeholder="ابحث في المهام، أو جرّب: متأخرة ‎#العمل" aria-label="بحث"
          className="min-w-0 flex-1 bg-transparent t-callout text-label outline-none placeholder:text-label-3" enterKeyHint="search"
        />
        {q && <button type="button" onClick={() => setQ("")} aria-label="مسح"><X size={17} className="rounded-full bg-label-3 p-0.5 text-[var(--bg)]" /></button>}
      </label>
      <AnimatePresence>
        {searching && (
          <motion.button initial={{ opacity: 0, width: 0 }} animate={{ opacity: 1, width: "auto" }} exit={{ opacity: 0, width: 0 }}
            type="button" onClick={() => { setQ(""); setSearch(false); input.current?.blur(); }} className="overflow-hidden whitespace-nowrap t-callout text-accent">
            إلغاء
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );

  return (
    <Page title="المهام" actions={<SyncBadge compact />} headerExtra={searchBar}>
      {searching ? (
        <SearchResults q={q} setQ={setQ} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {GRID.map((k, i) => {
              const m = SMART[k];
              const I = m.icon;
              return (
                <motion.div key={k} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03, type: "spring", stiffness: 400, damping: 32 }}>
                  <Press onClick={() => push({ name: "list", list: k })} scale={0.95}
                    className="glass flex w-full flex-col gap-2 rounded-[20px] p-3.5 text-start">
                    <div className="flex w-full items-start justify-between">
                      <span className="grid size-9 place-items-center rounded-full text-white" style={{ background: m.color, boxShadow: `0 6px 14px -6px ${m.color}` }}><I size={19} strokeWidth={2.4} /></span>
                      <span className="t-title2 num">{fmt.num(counts[k])}</span>
                    </div>
                    <span className="t-sub font-semibold text-label-2">{m.label}</span>
                  </Press>
                </motion.div>
              );
            })}
          </div>

          <div className="mt-7 flex items-end justify-between px-1 pb-2">
            <h2 className="t-title3">قوائمي</h2>
            <button type="button" onClick={() => editCategory()} className="flex items-center gap-1 t-sub font-medium text-accent"><Plus size={18} /> قائمة جديدة</button>
          </div>
          {cats.length === 0 ? (
            <EmptyState icon={<Inbox size={32} />} title="لا توجد قوائم" text="أنشئ قوائم لتنظيم مهامك: العمل، البيت، الدراسة…" />
          ) : (
            <div className="glass overflow-hidden rounded-[22px]">
              {cats.map((c) => {
                const n = catCounts[c.id];
                const total = (n?.active ?? 0) + (n?.done ?? 0);
                return (
                  <div key={c.id} className="row-sep" style={{ ["--sep-inset" as string]: "3.75rem" }}>
                    <button type="button" onClick={() => push({ name: "list", list: `cat:${c.id}` })}
                      onContextMenu={(e) => { e.preventDefault(); editCategory(c.id); }}
                      className="flex h-[58px] w-full items-center gap-3 px-4 active:bg-fill md:hover:bg-fill">
                      <CategoryIcon icon={c.icon} color={c.color} size={32} />
                      <div className="min-w-0 flex-1 text-start">
                        <p className="truncate t-body">{c.name}</p>
                        {total > 0 && (
                          <div className="mt-1 h-1 w-24 overflow-hidden rounded-full bg-fill">
                            <div className="h-full rounded-full" style={{ width: `${((n?.done ?? 0) / total) * 100}%`, background: c.color }} />
                          </div>
                        )}
                      </div>
                      <span className="t-body text-label-2 num">{fmt.num(n?.active ?? 0)}</span>
                      <ChevronLeft size={18} className="text-label-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
          <p className="mt-3 px-2 t-foot text-label-3">نصيحة: اضغط مطولًا (أو بالزر الأيمن) على قائمة لتعديلها.</p>
        </>
      )}
    </Page>
  );
}

const SUGGESTIONS = ["متأخرة", "اليوم", "!عالية", "بتذكير", "بدون موعد", "مكتملة"];

function SearchResults({ q, setQ }: { q: string; setQ: (v: string) => void }) {
  const now = useNow();
  const tasks = useTasks();
  const subs = useSubtasksByTask();
  const categories = useStore((s) => s.categories);
  const weekStart = useStore((s) => s.settings.weekStart);
  const cats = useCategories();
  const dq = useDeferredValue(q);
  const parsed = useMemo(() => parseQuery(dq), [dq]);
  const results = useMemo(() => (dq.trim() ? searchTasks(dq, tasks, subs, categories, weekStart, new Date(now)) : []), [dq, tasks, subs, categories, weekStart, now]);
  const fmt = useFmt();
  const add = (s: string) => setQ((q.trim() + " " + s).trim() + " ");

  return (
    <div>
      {parsed.chips.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5 px-1">
          <span className="t-foot text-label-2">فلاتر ذكية:</span>
          {parsed.chips.map((c) => <span key={c} className="rounded-full bg-[rgb(var(--accent-rgb)/0.13)] px-2.5 py-0.5 t-foot font-semibold text-accent">{c}</span>)}
        </div>
      )}
      {!dq.trim() ? (
        <div className="px-1">
          <p className="mb-2 t-foot font-semibold text-label-2">اقتراحات</p>
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => <Chip key={s} onClick={() => add(s)}>{s}</Chip>)}
            {cats.slice(0, 6).map((c) => <Chip key={c.id} onClick={() => add(`#${c.name.replace(/\s+/g, "_")}`)}><span className="size-2 rounded-full" style={{ background: c.color }} />#{c.name}</Chip>)}
          </div>
        </div>
      ) : results.length ? (
        <>
          <p className="mb-2 px-1 t-foot text-label-2">{fmt.num(results.length)} نتيجة</p>
          <TaskGroup tasks={results.slice(0, 200)} subtasks={subs} now={now} />
        </>
      ) : (
        <EmptyState icon={<SearchX size={32} />} title="لا نتائج" text="جرّب كلمة أخرى أو استخدم فلاتر مثل «متأخرة» أو «#اسم_القائمة»." />
      )}
    </div>
  );
}

function Chip({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return <Press onClick={onClick} scale={0.94} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-fill px-3.5 t-foot font-semibold">{children}</Press>;
}
