"use client";
import { Terrain } from "@lucasmarkes/hairline/react";
import { AnimatePresence, motion } from "motion/react";
import { AlarmClock, CalendarClock, CheckCheck, Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { addDays, dayKey, startOfDay } from "@/client/dates";
import { plural, useFmt } from "@/client/format";
import { isOverdue } from "@/client/hooks";
import { useUI } from "@/client/ui";
import type { TaskRec } from "@/lib/types";
import { cx } from "./ui/primitives";

const DAYS = 14;

/**
 * Today hero, Ozarex-style: a living Hairline terrain (plays by itself and
 * answers the pointer), a callout that cycles through the day's tasks, the
 * remaining-tasks figure, and a 14-day completion line.
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

  // Completions per day for the last 14 days (today last)
  const series = useMemo(() => {
    const per = new Map<string, number>();
    for (const t of allTasks) if (t.completed && t.completedAt) {
      const k = dayKey(new Date(t.completedAt));
      per.set(k, (per.get(k) ?? 0) + 1);
    }
    const t0 = startOfDay(now);
    return Array.from({ length: DAYS }, (_, i) => {
      const d = addDays(t0, i - DAYS + 1);
      return { d, n: per.get(dayKey(d)) ?? 0 };
    });
  }, [allTasks, now]);
  const sum14 = series.reduce((a, b) => a + b.n, 0);

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

      <Spark series={series} sum={sum14} />
    </motion.section>
  );
}

/** 14-day completion line (today on the left, as RTL time reads). */
function Spark({ series, sum }: { series: { d: Date; n: number }[]; sum: number }) {
  const fmt = useFmt();
  const W = 320, H = 92, PAD = 8;
  const max = Math.max(1, ...series.map((s) => s.n));
  const pts = series.map((s, i) => {
    const x = W - PAD - (i / (series.length - 1)) * (W - PAD * 2); // oldest at right, today at left
    const y = H - 16 - (s.n / max) * (H - 34);
    return [x, y] as const;
  });
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${line} L${pts[pts.length - 1][0].toFixed(1)},${H - 16} L${pts[0][0].toFixed(1)},${H - 16} Z`;
  const [ex, ey] = pts[pts.length - 1];
  const mid = series[Math.floor(series.length / 2)].d;
  return (
    <div className="relative z-10 -mx-2 pb-2">
      <div className="flex items-center justify-between px-2 t-cap text-label-2">
        <span>المنجز · آخر {fmt.num(DAYS)} يوم</span>
        <span className="font-semibold text-label"><bdi className="num">{fmt.num(sum)}</bdi> {plural(sum, ["مهمة", "مهمتان", "مهام", "مهمة"])}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-[92px] w-full" role="img" aria-label={`أنجزت ${sum} مهمة في آخر ${DAYS} يومًا`}>
        <defs>
          <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.32" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.33, 0.66].map((f) => <line key={f} x1={PAD} x2={W - PAD} y1={(H - 16) * f + 4} y2={(H - 16) * f + 4} stroke="var(--separator)" strokeDasharray="2 4" />)}
        <motion.path d={area} fill="url(#spark-fill)" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8 }} />
        <motion.path d={line} fill="none" stroke="var(--accent)" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"
          initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.2, ease: [0.32, 0.72, 0, 1] }} />
        <circle cx={ex} cy={ey} r={9} fill="var(--accent)" opacity={0.18} className="hero-pulse" />
        <circle cx={ex} cy={ey} r={4.5} fill="var(--accent)" stroke="white" strokeWidth={2} />
        <text x={ex} y={H - 2} textAnchor="end" fontSize="10" fill="var(--label-2)">النهارده</text>
        <text x={W / 2} y={H - 2} textAnchor="middle" fontSize="10" fill="var(--label-3)">{fmt.date(mid, { day: "numeric", month: "numeric" })}</text>
        <text x={W - PAD} y={H - 2} textAnchor="start" fontSize="10" fill="var(--label-3)">{fmt.date(series[0].d, { day: "numeric", month: "numeric" })}</text>
      </svg>
    </div>
  );
}
