"use client";
import { AnimatePresence, motion } from "motion/react";
import { CalendarCheck2, ChevronLeft, ChevronRight, Plus, Rss } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { addDays, addMonths, dayKey, isSameDay, startOfDay, startOfMonth, startOfWeek } from "@/client/dates";
import { useFmt } from "@/client/format";
import { sortTasks, useNow, useSubtasksByTask, useTasks } from "@/client/hooks";
import { useStore } from "@/client/store";
import { useContextDraft, useUI } from "@/client/ui";
import type { TaskRec } from "@/lib/types";
import { cx, IconButton, Press, Segmented } from "../ui/primitives";
import { Page } from "../ui/Page";
import { TaskGroup, TaskRow } from "../tasks/TaskRow";

type Mode = "day" | "week" | "month";

export function CalendarView() {
  const now = useNow();
  const fmt = useFmt();
  const tasks = useTasks();
  const subs = useSubtasksByTask();
  const cats = useStore((s) => s.categories);
  const weekStart = useStore((s) => s.settings.weekStart);
  const newTask = useUI((s) => s.newTask);
  const [mode, setMode] = useState<Mode>(() => (typeof localStorage !== "undefined" && (localStorage.getItem("mh_cal_mode") as Mode)) || "month");
  const [sel, setSel] = useState(() => startOfDay(Date.now()));
  const [dir, setDir] = useState(1);
  useEffect(() => { try { localStorage.setItem("mh_cal_mode", mode); } catch { /* ignore */ } }, [mode]);
  useContextDraft({ dueAt: sel.toISOString(), allDay: true }, [sel.getTime()]);

  const byDay = useMemo(() => {
    const m = new Map<string, TaskRec[]>();
    for (const t of tasks) {
      if (!t.dueAt) continue;
      const k = dayKey(new Date(t.dueAt));
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(t);
    }
    for (const l of m.values()) l.sort((a, b) => Number(a.completed) - Number(b.completed) || (a.dueAt! < b.dueAt! ? -1 : 1));
    return m;
  }, [tasks]);

  const move = (n: number) => {
    setDir(n);
    setSel((d) => (mode === "day" ? addDays(d, n) : mode === "week" ? addDays(d, 7 * n) : startOfMonth(addMonths(d, n))));
  };
  const goToday = () => { setDir(sel.getTime() > now ? -1 : 1); setSel(startOfDay(now)); };

  const title = mode === "day" ? fmt.date(sel, { day: "numeric", month: "long", year: "numeric" }) : fmt.month(sel);
  const isToday = isSameDay(sel, now);

  return (
    <Page
      title={title}
      subtitle={mode === "day" ? fmt.weekday(sel) : undefined}
      actions={
        <>
          {!isToday && <button type="button" onClick={goToday} className="rounded-full bg-[rgb(var(--accent-rgb)/0.13)] px-3 py-1 t-foot font-semibold text-accent">اليوم</button>}
          <IconButton label="السابق" onClick={() => move(-1)}><ChevronRight size={22} /></IconButton>
          <IconButton label="التالي" onClick={() => move(1)}><ChevronLeft size={22} /></IconButton>
        </>
      }
      headerExtra={
        <Segmented id="calmode" className="mb-4" value={mode} onChange={setMode}
          options={[{ value: "day", label: "يوم" }, { value: "week", label: "أسبوع" }, { value: "month", label: "شهر" }]} />
      }
    >
      {mode === "month" && <MonthGrid sel={sel} setSel={setSel} byDay={byDay} weekStart={weekStart} now={now} cats={cats} dir={dir} onSwipe={move} />}
      {mode === "week" && <WeekStrip sel={sel} setSel={setSel} byDay={byDay} weekStart={weekStart} now={now} />}

      {mode === "day" ? (
        <DayTimeline sel={sel} tasks={byDay.get(dayKey(sel)) ?? []} now={now} subs={subs} />
      ) : mode === "week" ? (
        <WeekAgenda sel={sel} byDay={byDay} weekStart={weekStart} now={now} subs={subs} />
      ) : (
        <div className="mt-5">
          <div className="flex items-center justify-between px-1 pb-2">
            <h2 className="t-title3">{fmt.relDay(sel, now)}{!isToday && <span className="ms-2 t-sub font-normal text-label-2">{fmt.date(sel, { weekday: "long", day: "numeric", month: "long" })}</span>}</h2>
            <IconButton label="إضافة مهمة في هذا اليوم" onClick={() => newTask({ dueAt: sel.toISOString(), allDay: true })}><Plus size={22} /></IconButton>
          </div>
          <DayList tasks={byDay.get(dayKey(sel)) ?? []} subs={subs} now={now} />
        </div>
      )}

      <CalendarSubscribeHint />
    </Page>
  );
}

function DayList({ tasks, subs, now }: { tasks: TaskRec[]; subs: Record<string, import("@/lib/types").SubtaskRec[]>; now: number }) {
  if (!tasks.length) return <p className="glass rounded-[20px] px-4 py-5 text-center t-sub text-label-2">لا مهام في هذا اليوم</p>;
  return <TaskGroup tasks={tasks} subtasks={subs} now={now} showDate={false} />;
}

function MonthGrid({ sel, setSel, byDay, weekStart, now, cats, dir, onSwipe }: {
  sel: Date; setSel: (d: Date) => void; byDay: Map<string, TaskRec[]>; weekStart: number; now: number;
  cats: Record<string, { color: string }>; dir: number; onSwipe: (n: number) => void;
}) {
  const fmt = useFmt();
  const month = startOfMonth(sel);
  const start = startOfWeek(month, weekStart);
  const days = Array.from({ length: 42 }, (_, i) => addDays(start, i));
  const rows = days[35].getMonth() === month.getMonth() ? 6 : 5;
  const names = Array.from({ length: 7 }, (_, i) => fmt.weekday(addDays(start, i), "narrow"));

  return (
    <div className="glass overflow-hidden rounded-[24px] p-2.5">
      <div className="mb-1 grid grid-cols-7 text-center t-cap font-semibold text-label-3">{names.map((n, i) => <span key={i} className="py-1">{n}</span>)}</div>
      <AnimatePresence mode="popLayout" initial={false} custom={dir}>
        <motion.div
          key={dayKey(month)} custom={dir}
          initial={{ opacity: 0, x: dir > 0 ? -40 : 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: dir > 0 ? 40 : -40 }}
          transition={{ type: "spring", stiffness: 420, damping: 38 }}
          drag="x" dragConstraints={{ left: 0, right: 0 }} dragElastic={0.25}
          onDragEnd={(_, i) => { if (i.offset.x > 60) onSwipe(1); else if (i.offset.x < -60) onSwipe(-1); }}
          className="grid grid-cols-7 gap-y-1"
        >
          {days.slice(0, rows * 7).map((d) => {
            const k = dayKey(d);
            const list = byDay.get(k) ?? [];
            const open = list.filter((t) => !t.completed);
            const inMonth = d.getMonth() === month.getMonth();
            const today = isSameDay(d, now);
            const selected = isSameDay(d, sel);
            const dots = [...new Set(open.map((t) => (t.categoryId && cats[t.categoryId]?.color) || "var(--accent)"))].slice(0, 3);
            return (
              <button key={k} type="button" onClick={() => setSel(startOfDay(d))} aria-label={fmt.date(d, { weekday: "long", day: "numeric", month: "long" })} aria-pressed={selected}
                className={cx("flex h-[52px] flex-col items-center justify-start gap-1 rounded-2xl pt-1.5 transition-colors", selected && !today && "bg-fill", !inMonth && "opacity-35")}>
                <span className={cx("grid size-8 place-items-center rounded-full t-callout num",
                  today ? "glass-pill font-bold text-white" : selected ? "font-bold text-accent" : "")}>
                  {fmt.num(d.getDate())}
                </span>
                <span className="flex h-1.5 gap-[3px]">
                  {dots.map((c, i) => <span key={i} className="size-1.5 rounded-full" style={{ background: c }} />)}
                  {!dots.length && list.length > 0 && <span className="size-1.5 rounded-full bg-label-3" />}
                </span>
              </button>
            );
          })}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function WeekStrip({ sel, setSel, byDay, weekStart, now }: { sel: Date; setSel: (d: Date) => void; byDay: Map<string, TaskRec[]>; weekStart: number; now: number }) {
  const fmt = useFmt();
  const start = startOfWeek(sel, weekStart);
  return (
    <div className="glass grid grid-cols-7 gap-1 rounded-[24px] p-2">
      {Array.from({ length: 7 }, (_, i) => addDays(start, i)).map((d) => {
        const open = (byDay.get(dayKey(d)) ?? []).filter((t) => !t.completed).length;
        const selected = isSameDay(d, sel);
        const today = isSameDay(d, now);
        return (
          <Press key={d.getTime()} onClick={() => setSel(startOfDay(d))} scale={0.92}
            className={cx("relative flex flex-col items-center gap-1 rounded-2xl py-2", selected ? "glass-pill text-white" : today ? "text-accent" : "")}>
            <span className={cx("t-cap font-semibold", !selected && "text-label-2", today && !selected && "text-accent")}>{fmt.weekday(d, "narrow")}</span>
            <span className="t-headline num">{fmt.num(d.getDate())}</span>
            <span className={cx("t-cap num", selected ? "text-white/85" : "text-label-3")}>{open ? fmt.num(open) : "·"}</span>
          </Press>
        );
      })}
    </div>
  );
}

function WeekAgenda({ sel, byDay, weekStart, now, subs }: { sel: Date; byDay: Map<string, TaskRec[]>; weekStart: number; now: number; subs: Record<string, import("@/lib/types").SubtaskRec[]> }) {
  const fmt = useFmt();
  const newTask = useUI((s) => s.newTask);
  const start = startOfWeek(sel, weekStart);
  const refs = useRef<Record<string, HTMLElement | null>>({});
  useEffect(() => { refs.current[dayKey(sel)]?.scrollIntoView({ behavior: "smooth", block: "nearest" }); }, [sel]);
  return (
    <div className="mt-5 space-y-4">
      {Array.from({ length: 7 }, (_, i) => addDays(start, i)).map((d) => {
        const k = dayKey(d);
        const list = byDay.get(k) ?? [];
        const today = isSameDay(d, now);
        return (
          <section key={k} ref={(el) => { refs.current[k] = el; }} className="scroll-mt-28">
            <div className="flex items-center justify-between px-1 pb-1.5">
              <h3 className={cx("t-headline", today && "text-accent", isSameDay(d, sel) && "underline decoration-2 underline-offset-8")}>
                {fmt.weekday(d)} <span className="t-sub font-normal text-label-2">{fmt.date(d)}</span>
              </h3>
              <button type="button" aria-label="إضافة" onClick={() => newTask({ dueAt: d.toISOString(), allDay: true })} className="grid size-8 place-items-center rounded-full text-accent hover:bg-fill"><Plus size={19} /></button>
            </div>
            {list.length ? <TaskGroup tasks={sortTasks(list)} subtasks={subs} now={now} showDate={false} /> : <div className="rounded-2xl border border-dashed border-separator px-4 py-2.5 t-foot text-label-3">لا مهام</div>}
          </section>
        );
      })}
    </div>
  );
}

function DayTimeline({ sel, tasks, now, subs }: { sel: Date; tasks: TaskRec[]; now: number; subs: Record<string, import("@/lib/types").SubtaskRec[]> }) {
  const fmt = useFmt();
  const newTask = useUI((s) => s.newTask);
  const scrollTo = useRef<HTMLDivElement>(null);
  const allDay = tasks.filter((t) => t.allDay);
  const timed = tasks.filter((t) => !t.allDay);
  const today = isSameDay(sel, now);
  const nowH = new Date(now).getHours();
  useEffect(() => { scrollTo.current?.scrollIntoView({ block: "center" }); }, [sel]);
  const focusHour = today ? nowH : Math.min(...timed.map((t) => new Date(t.dueAt!).getHours()), 8);

  return (
    <div>
      <div className="mb-4">
        <p className="px-1 pb-1.5 t-foot font-semibold text-label-2">طوال اليوم</p>
        {allDay.length ? <TaskGroup tasks={allDay} subtasks={subs} now={now} showDate={false} /> : <div className="rounded-2xl border border-dashed border-separator px-4 py-2.5 t-foot text-label-3">لا مهام بدون وقت</div>}
      </div>
      <div className="glass overflow-hidden rounded-[22px]">
        {Array.from({ length: 24 }, (_, h) => {
          const inHour = timed.filter((t) => new Date(t.dueAt!).getHours() === h);
          const label = fmt.time(new Date(2000, 0, 1, h, 0));
          return (
            <div key={h} ref={h === focusHour ? scrollTo : undefined} className="row-sep relative flex min-h-[52px]" style={{ ["--sep-inset" as string]: "4.5rem" }}>
              <div className="w-[4.5rem] shrink-0 pe-2 ps-3 pt-2 t-cap text-label-2 num">{label}</div>
              <div className="relative min-w-0 flex-1 border-s border-separator">
                {today && h === nowH && (
                  <div className="pointer-events-none absolute inset-x-0 z-0 flex items-center opacity-80" style={{ top: `${(new Date(now).getMinutes() / 60) * 100}%` }}>
                    <span className="-ms-1 size-2 rounded-full bg-ios-red" /><span className="h-[1.5px] flex-1 bg-ios-red" />
                  </div>
                )}
                {inHour.length ? <div className="relative z-[1]">{inHour.map((t) => <TaskRow key={t.id} task={t} subtasks={subs[t.id]} now={now} showDate={false} />)}</div> : (
                  <button type="button" aria-label={`إضافة مهمة الساعة ${label}`} className="absolute inset-0 opacity-0 hover:opacity-100 focus:opacity-100"
                    onClick={() => { const d = new Date(sel); d.setHours(h, 0, 0, 0); newTask({ dueAt: d.toISOString(), allDay: false }); }}>
                    <span className="ms-3 inline-flex items-center gap-1 t-foot text-accent"><Plus size={14} /> إضافة</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CalendarSubscribeHint() {
  const setTab = useUI((s) => s.setTab);
  return (
    <button type="button" onClick={() => setTab("settings")} className="glass mt-6 flex w-full items-center gap-3 rounded-[20px] p-4 text-start">
      <span className="grid size-10 place-items-center rounded-xl bg-[rgb(var(--accent-rgb)/0.14)] text-accent"><Rss size={20} /></span>
      <div className="flex-1">
        <p className="t-callout font-semibold">اربط مهامك بتقويم هاتفك</p>
        <p className="t-foot text-label-2">اشترك في رابط التقويم من Google أو Apple أو Outlook ليظهر كل موعد تلقائيًا.</p>
      </div>
      <CalendarCheck2 size={20} className="text-label-3" />
    </button>
  );
}
