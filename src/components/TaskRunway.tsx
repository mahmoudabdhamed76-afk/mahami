"use client";
import { AnimatePresence, motion } from "motion/react";
import { BellRing, Navigation2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { plural, useFmt } from "@/client/format";
import { useStore } from "@/client/store";
import { useUI } from "@/client/ui";
import type { TaskRec } from "@/lib/types";
import { cx } from "./ui/primitives";

const HORIZON_MIN = 48 * 60; // tasks further than 48h wait off-track
const LANES = 3;
const TICKS: [number, string][] = [[60, "ساعة"], [360, "٦ س"], [1440, "يوم"]];
const DOCK = 52; // px
const CAR = 112; // px, max car width
/** right offset of a car's front at track fraction p */
const at = (p: number, extra = 0) => `calc((100% - ${DOCK + CAR + 6}px) * ${p.toFixed(4)} + ${DOCK + 4 + extra}px)`;

/** Log scale: the last hour takes a big share of the track, so near tasks visibly travel. */
const pos = (min: number) => Math.min(1, Math.log1p(Math.max(0, min) / 12) / Math.log1p(HORIZON_MIN / 12));

/**
 * "مهامي في الطريق" — every timed task rides a lane toward the «الآن» dock.
 * Positions update every second; when a task's time comes it lands on the dock
 * with a burst, and stays docked until it's done.
 */
export function TaskRunway({ tasks }: { tasks: TaskRec[] }) {
  const fmt = useFmt();
  const cats = useStore((s) => s.categories);
  const openTask = useUI((s) => s.openTask);
  const newTask = useUI((s) => s.newTask);
  const [now, setNow] = useState(() => Date.now());
  const [bursts, setBursts] = useState<string[]>([]);
  const prevArrived = useRef<Set<string> | null>(null);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const { riding, docked, later } = useMemo(() => {
    const timed = tasks
      .filter((t) => !t.completed && t.dueAt && !t.allDay)
      .map((t) => ({ t, min: (Date.parse(t.dueAt!) - now) / 60000 }))
      .sort((a, b) => a.min - b.min);
    const docked = timed.filter((x) => x.min <= 0 && x.min > -12 * 60);
    const riding = timed.filter((x) => x.min > 0 && x.min <= HORIZON_MIN);
    const later = timed.filter((x) => x.min > HORIZON_MIN).length;
    return { riding, docked, later };
  }, [tasks, now]);

  // Detect arrivals (crossing zero while the screen is open) → burst on the dock
  useEffect(() => {
    const ids = new Set(docked.map((d) => d.t.id));
    const prev = prevArrived.current;
    if (prev) {
      const fresh = [...ids].filter((id) => !prev.has(id));
      if (fresh.length) {
        setBursts((b) => [...b, ...fresh]);
        if (typeof navigator !== "undefined") navigator.vibrate?.([12, 60, 12]);
        setTimeout(() => setBursts((b) => b.filter((x) => !fresh.includes(x))), 1800);
      }
    }
    prevArrived.current = ids;
  }, [docked]);

  const eta = (min: number) => {
    if (min < 1) return "دلوقتي";
    if (min < 60) return `بعد ${fmt.num(Math.ceil(min))} د`;
    if (min < 3 * 60) { const tot = Math.round(min), h = Math.floor(tot / 60), m = tot % 60; return m ? `بعد ${fmt.num(h)}:${String(m).padStart(2, "0").replace(/\d/g, (d) => fmt.num(+d))} س` : `بعد ${fmt.num(h)} س`; }
    if (min < 24 * 60) return `بعد ${fmt.num(Math.round(min / 60))} س`;
    return `بعد ${fmt.num(Math.round(min / 1440))} يوم`;
  };

  // Greedy lanes: put each car in the lane whose previous car is furthest away
  const lanes = useMemo(() => {
    const last: number[] = Array(LANES).fill(-Infinity);
    const out = new Map<string, number>();
    for (const { t, min } of riding) {
      const p = pos(min);
      let best = 0, gap = -Infinity;
      for (let l = 0; l < LANES; l++) { const g = p - last[l]; if (g > 0.55) { best = l; gap = Infinity; break; } if (g > gap) { gap = g; best = l; } }
      last[best] = p;
      out.set(t.id, best);
    }
    return out;
  }, [riding]);

  const next = riding[0];
  const clock = fmt.time(now);

  return (
    <section className="relative z-10 mt-2" aria-label="مهامي في الطريق">
      <div className="mb-2 flex items-end justify-between px-1">
        <div>
          <h2 className="t-headline">مهامي في الطريق</h2>
          <p className="t-cap text-label-2">
            {riding.length || docked.length
              ? next ? <>أقرب مهمة <b className="font-semibold text-label">{eta(next.min)}</b></> : "وصلت مهامك 👇"
              : "مفيش مهام بوقت محدد جاية"}
            {later > 0 && <> · <bdi className="num">{fmt.num(later)}</bdi> بعد يومين</>}
          </p>
        </div>
        <span className="flex items-center gap-1 rounded-full bg-fill px-2.5 py-1 t-cap font-semibold num">
          <span className="size-1.5 animate-pulse rounded-full bg-ios-green" />{clock}
        </span>
      </div>

      <div className="runway relative overflow-hidden rounded-[22px]" style={{ height: 46 * LANES + 44 }}>
        {/* flowing lanes */}
        {Array.from({ length: LANES }, (_, i) => (
          <div key={i} className="runway-lane absolute inset-x-0" style={{ top: 18 + i * 46 + 22 }} aria-hidden />
        ))}

        {/* time ticks */}
        {TICKS.map(([m, l]) => (
          <div key={m} className="absolute bottom-0 top-0 flex flex-col items-center" style={{ right: at(pos(m), 14) }} aria-hidden>
            <span className="h-full w-px bg-[linear-gradient(to_bottom,transparent,var(--separator)_30%,transparent)]" />
            <span className="absolute bottom-1 whitespace-nowrap t-cap text-label-3">{l}</span>
          </div>
        ))}

        {/* the «الآن» dock */}
        <div className="runway-dock absolute bottom-0 right-0 top-0 flex w-[52px] flex-col items-center justify-center gap-1">
          <span className="runway-beacon" />
          <Navigation2 size={18} className="relative -rotate-90 text-accent" />
          <span className="relative t-cap font-bold text-accent">الآن</span>
        </div>

        {/* arrival bursts */}
        <AnimatePresence>
          {bursts.map((id) => (
            <motion.span key={id} className="pointer-events-none absolute right-[8px] top-1/2 size-9 -translate-y-1/2 rounded-full border-2 border-accent"
              initial={{ scale: 0.4, opacity: 1 }} animate={{ scale: 4, opacity: 0 }} exit={{ opacity: 0 }} transition={{ duration: 1.4, ease: "easeOut" }} />
          ))}
        </AnimatePresence>

        {/* riding tasks */}
        <AnimatePresence>
          {riding.map(({ t, min }, i) => {
            const color = (t.categoryId && cats[t.categoryId]?.color) || "var(--accent)";
            const near = min <= 15;
            const p = pos(min);
            return (
              <motion.button
                key={t.id} type="button" onClick={() => openTask(t.id)}
                initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.6, x: 40 }}
                transition={{ type: "spring", stiffness: 300, damping: 26 }}
                className={cx("runway-car glass-strong absolute flex max-w-[112px] items-center gap-1.5 rounded-full py-1 pe-2.5 ps-1", near && "runway-near")}
                style={{ top: 18 + (lanes.get(t.id) ?? i % LANES) * 46, right: at(p), ["--car" as string]: color }}
                title={`${t.title} — ${eta(min)}`}
              >
                <span className="grid size-7 shrink-0 place-items-center rounded-full text-[11px] font-bold text-white" style={{ background: color }}>
                  {fmt.time(t.dueAt!).replace(/\s?[صم]$/, "")}
                </span>
                <span className="min-w-0 text-start leading-tight">
                  <span className="block truncate t-cap font-semibold text-label">{t.title}</span>
                  <span className={cx("block t-cap num", near ? "font-semibold text-ios-orange" : "text-label-2")}>{eta(min)}</span>
                </span>
              </motion.button>
            );
          })}
        </AnimatePresence>

        {!riding.length && !docked.length && (
          <button type="button" onClick={() => newTask(undefined, true)}
            className="absolute inset-y-0 left-0 right-[52px] flex items-center justify-center px-6 text-center t-foot text-label-2">
            حدّد وقت لمهامك وهتشوفها جاية في الطريق لحد ما توصل
          </button>
        )}
      </div>

      {/* docked: time has come */}
      <AnimatePresence initial={false}>
        {docked.length > 0 && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="mt-2 space-y-1.5">
            {docked.map(({ t, min }) => (
              <motion.button
                key={t.id} layout type="button" onClick={() => openTask(t.id)}
                initial={{ opacity: 0, x: 60, scale: 0.9 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={{ opacity: 0, x: -30 }}
                className="runway-arrived glass-strong flex w-full items-center gap-3 rounded-2xl px-3 py-2"
              >
                <span className="grid size-8 place-items-center rounded-full bg-[rgb(var(--accent-rgb)/0.16)] text-accent"><BellRing size={16} /></span>
                <span className="min-w-0 flex-1 text-start">
                  <span className="block truncate t-sub font-semibold">{t.title}</span>
                  <span className="block t-cap text-label-2">
                    {min > -1 ? "وصلت دلوقتي" : `وصلت من ${fmt.num(Math.round(-min) >= 60 ? Math.round(-min / 60) : Math.round(-min))} ${Math.round(-min) >= 60 ? "س" : "د"}`} · {fmt.time(t.dueAt!)}
                  </span>
                </span>
                <span className="t-cap font-semibold text-accent">افتح</span>
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {riding.length > 0 && (
        <p className="mt-1.5 px-1 t-cap text-label-3">
          {fmt.num(riding.length)} {plural(riding.length, ["مهمة", "مهمتان", "مهام", "مهمة"])} في الطريق · المسافة بتقصر مع الوقت لحد ما توصل «الآن»
        </p>
      )}
    </section>
  );
}
