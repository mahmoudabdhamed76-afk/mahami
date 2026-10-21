"use client";
import { AnimatePresence, motion } from "motion/react";
import { Navigation2 } from "lucide-react";
import { useMemo } from "react";
import { plural } from "@/client/format";
import { useUI } from "@/client/ui";
import { cx } from "../ui/primitives";
import type { BodyProps } from "../TaskRunway";
import { pos, TICKS, useEta } from "./core";

const LANES = 3;
const DOCK = 52; // px
const CAR = 112; // px, max car width
/** right offset of a car's front at track fraction p */
const at = (p: number, extra = 0) => `calc((100% - ${DOCK + CAR + 6}px) * ${p.toFixed(4)} + ${DOCK + 4 + extra}px)`;

/** Original style: three horizontal lanes flowing into the «الآن» dock. */
export function LanesBody({ riding, docked, bursts }: BodyProps) {
  const { eta, hhmm, fmt } = useEta();
  const openTask = useUI((s) => s.openTask);
  const newTask = useUI((s) => s.newTask);

  // Greedy lanes: put each car in the lane whose previous car is furthest away
  const lanes = useMemo(() => {
    const last: number[] = Array(LANES).fill(-Infinity);
    const out = new Map<string, number>();
    for (const { t, p } of riding) {
      let best = 0, gap = -Infinity;
      for (let l = 0; l < LANES; l++) { const g = p - last[l]; if (g > 0.55) { best = l; gap = Infinity; break; } if (g > gap) { gap = g; best = l; } }
      last[best] = p;
      out.set(t.id, best);
    }
    return out;
  }, [riding]);

  return (
    <>
      <div className="runway relative overflow-hidden rounded-[22px]" style={{ height: 46 * LANES + 44 }}>
        {Array.from({ length: LANES }, (_, i) => (
          <div key={i} className="runway-lane absolute inset-x-0" style={{ top: 18 + i * 46 + 22 }} aria-hidden />
        ))}
        {TICKS.map(([m, l]) => (
          <div key={m} className="absolute bottom-0 top-0 flex flex-col items-center" style={{ right: at(pos(m), 14) }} aria-hidden>
            <span className="h-full w-px bg-[linear-gradient(to_bottom,transparent,var(--separator)_30%,transparent)]" />
            <span className="absolute bottom-1 whitespace-nowrap t-cap text-label-3">{l}</span>
          </div>
        ))}
        <div className="runway-dock absolute bottom-0 right-0 top-0 flex w-[52px] flex-col items-center justify-center gap-1">
          <span className="runway-beacon" />
          <Navigation2 size={18} className="relative -rotate-90 text-accent" />
          <span className="relative t-cap font-bold text-accent">الآن</span>
        </div>
        <AnimatePresence>
          {bursts.map((id) => (
            <motion.span key={id} className="pointer-events-none absolute right-[8px] top-1/2 size-9 -translate-y-1/2 rounded-full border-2 border-accent"
              initial={{ scale: 0.4, opacity: 1 }} animate={{ scale: 4, opacity: 0 }} exit={{ opacity: 0 }} transition={{ duration: 1.4, ease: "easeOut" }} />
          ))}
        </AnimatePresence>
        <AnimatePresence>
          {riding.map(({ t, min, p, color }, i) => {
            const near = min <= 15;
            return (
              <motion.button
                key={t.id} type="button" onClick={() => openTask(t.id)}
                initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.6, x: 40 }}
                transition={{ type: "spring", stiffness: 300, damping: 26 }}
                className={cx("runway-car glass-strong absolute flex max-w-[112px] items-center gap-1.5 rounded-full py-1 pe-2.5 ps-1", near && "runway-near")}
                style={{ top: 18 + (lanes.get(t.id) ?? i % LANES) * 46, right: at(p), ["--car" as string]: color }}
                title={`${t.title} — ${eta(min)}`}
              >
                <span className="grid size-7 shrink-0 place-items-center rounded-full text-[11px] font-bold text-white" style={{ background: color }}>{hhmm(t.dueAt!)}</span>
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
      {riding.length > 0 && (
        <p className="mt-1.5 px-1 t-cap text-label-3">
          {fmt.num(riding.length)} {plural(riding.length, ["مهمة", "مهمتان", "مهام", "مهمة"])} في الطريق · المسافة بتقصر مع الوقت لحد ما توصل «الآن»
        </p>
      )}
    </>
  );
}
