"use client";
import { Terrain } from "@lucasmarkes/hairline/react";
import { AnimatePresence, motion } from "motion/react";
import { AlarmClock, CalendarClock, CheckCheck, Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { startOfDay } from "@/client/dates";
import { plural, useFmt } from "@/client/format";
import { isOverdue } from "@/client/hooks";
import { useUI } from "@/client/ui";
import type { TaskRec } from "@/lib/types";
import { cx } from "./ui/primitives";
import { TaskRunway } from "./TaskRunway";


/**
 * Today hero, Ozarex-style: a living Hairline terrain (plays by itself and
 * answers the pointer), a callout that cycles through the day's tasks, the
 * remaining-tasks figure, and the runway where timed tasks travel toward «now».
 */
export function TodayHero({ greeting, overdue, today, done, allTasks, now }: {
  greeting: string; overdue: TaskRec[]; today: TaskRec[]; done: TaskRec[]; allTasks: TaskRec[]; now: number;
}) {
  const fmt = useFmt();
  const openTask = useUI((s) => s.openTask);
  const newTask = useUI((s) => s.newTask);
  const queue = useMemo(() => [...overdue, ...today], [overdue, today]);
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reduce, setReduce] = useState(false);

  useEffect(() => { setReduce(matchMedia("(prefers-reduced-motion: reduce)").matches); }, []);
  useEffect(() => { if (idx >= queue.length) setIdx(0); }, [queue.length, idx]);
  useEffect(() => {
    if (paused || queue.length < 2) return;
    const id = setInterval(() => setIdx((i) => (i + 1) % queue.length), 4200);
    return () => clearInterval(id);
  }, [paused, queue.length]);

  const current = queue[idx] ?? null;
  const total = queue.length + done.length;
  const remaining = queue.length;


  const callout = current ? (
    <>
      <span className={cx("grid size-9 shrink-0 place-items-center rounded-xl", isOverdue(current, now) ? "bg-[color-mix(in_srgb,var(--red)_16%,transparent)] text-ios-red" : "bg-[rgb(var(--accent-rgb)/0.15)] text-accent")}>
        {isOverdue(current, now) ? <AlarmClock size={18} /> : <CalendarClock size={18} />}
      </span>
      <span className="min-w-0 flex-1 text-start">
        <span className={cx("block t-cap font-semibold", isOverdue(current, now) ? "text-ios-red" : "text-accent")}>
          {isOverdue(current, now) ? "متأخرة" : "المهمة التالية"} · {current.dueAt && !current.allDay ? fmt.time(current.dueAt) : fmt.relDay(current.dueAt ?? now, now)}
          {queue.length > 1 && <span className="ms-1.5 text-label-3 num">{fmt.num(idx + 1)}/{fmt.num(queue.length)}</span>}
        </span>
        <span className="block truncate t-sub font-semibold">{current.title}</span>
      </span>
    </>
  ) : (
    <>
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[rgb(var(--accent-rgb)/0.15)] text-accent">
        {done.length ? <CheckCheck size={18} /> : <Plus size={18} />}
      </span>
      <span className="min-w-0 flex-1 text-start">
        <span className="block t-cap font-semibold text-accent">{done.length ? "يوم منجز" : "يومك فاضي"}</span>
        <span className="block truncate t-sub font-semibold">{done.length ? "خلّصت كل مهام النهارده 🎉" : "اضغط هنا وأضف أول مهمة"}</span>
      </span>
    </>
  );

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 260, damping: 28 }}
      className="hero-terrain relative mb-4"
      onPointerEnter={() => setPaused(true)} onPointerLeave={() => setPaused(false)}
    >
      <div className="hero-glow" aria-hidden><span /><span /></div>

      {/* Callout cycling through today's tasks */}
      <div className="relative z-10 pt-1">
        <AnimatePresence mode="wait" initial={false}>
          <motion.button
            key={current?.id ?? "empty"} type="button"
            onClick={() => (current ? openTask(current.id) : newTask({ dueAt: startOfDay(now).toISOString(), allDay: true }))}
            initial={{ opacity: 0, y: -8, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
            className="hero-callout glass-strong relative flex w-full items-center gap-3 rounded-2xl px-3 py-2.5"
          >
            {callout}
          </motion.button>
        </AnimatePresence>
      </div>

      {/* The living terrain */}
      <div className="relative -mx-4 -mt-6 h-[230px] sm:h-[260px]" onClick={() => queue.length > 1 && setIdx((i) => (i + 1) % queue.length)}>
        <Terrain
          className="hero-terrain-fig absolute inset-x-[-8%] -top-[18%] !aspect-auto h-[136%]"
          play={!reduce}
          intensity={0.75}
          label="تضاريس المهام — حرّك إصبعك عليها"
        />
      </div>

      {/* Figures */}
      <div className="relative z-10 px-1 pb-1">
        <p className="t-sub text-label-2">{greeting} · مهام اليوم</p>
        <div className="mt-1 flex flex-wrap items-end gap-x-3 gap-y-1">
          <motion.span key={remaining} initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="hero-mark t-large num">
            {remaining ? `${fmt.num(remaining)} ${plural(remaining, ["مهمة", "مهمتان", "مهام", "مهمة"])}` : total ? "تم ✓" : "ابدأ يومك"}
          </motion.span>
          <span className="flex flex-wrap items-center gap-x-2 pb-1.5 t-foot text-label-2">
            {total ? (
              <>
                <span>أنجزت <bdi className="num">{fmt.num(done.length)}</bdi> من <bdi className="num">{fmt.num(total)}</bdi></span>
                <span aria-hidden>·</span>
                <bdi className="num font-semibold text-label">{fmt.pct(done.length / total)}</bdi>
              </>
            ) : <span>لا توجد مهام لليوم بعد</span>}
            {overdue.length > 0 && (<><span aria-hidden>·</span><span className="font-semibold text-ios-red"><bdi className="num">{fmt.num(overdue.length)}</bdi> متأخرة</span></>)}
          </span>
        </div>
      </div>

      <TaskRunway tasks={allTasks} />
    </motion.section>
  );
}
