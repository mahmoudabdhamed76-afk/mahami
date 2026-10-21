"use client";
import { AnimatePresence, motion } from "motion/react";
import { Check } from "lucide-react";
import { useUI } from "@/client/ui";
import { cx } from "../ui/primitives";
import type { BodyProps } from "../TaskRunway";
import { useEta } from "./core";

const MAX_STOPS = 6;

type Seg = "done" | "flow" | "idle" | "none";

/** One row on the line: rail (line above/below + station) and content. */
function Stop({ top, bottom, station, children }: { top: Seg; bottom: Seg; station: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-stretch gap-3">
      <div className="relative w-8 shrink-0">
        <span className={cx("metro-seg top-0 h-1/2", `metro-${top}`)} />
        <span className={cx("metro-seg bottom-0 h-1/2", `metro-${bottom}`)} />
        <div className="absolute inset-0 grid place-items-center">{station}</div>
      </div>
      <div className="min-w-0 flex-1 py-1.5">{children}</div>
    </div>
  );
}

/** Metro line: done stops above, a live «الآن» marker, upcoming tasks as stations below. */
export function MetroBody({ riding, doneToday, bursts, now }: BodyProps) {
  const { eta, short, fmt } = useEta();
  const openTask = useUI((s) => s.openTask);
  const done = doneToday.slice(-2);
  const stops = riding.slice(0, MAX_STOPS);
  const more = riding.length - stops.length;

  return (
    <div className="runway rounded-[26px] px-3 py-3">
      <AnimatePresence initial={false}>
        {done.map(({ t }, i) => (
          <motion.div key={t.id} layout initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
            <Stop top={i === 0 ? "none" : "done"} bottom="done"
              station={<span className="grid size-6 place-items-center rounded-full bg-ios-green text-white"><Check size={14} strokeWidth={3} /></span>}>
              <button type="button" onClick={() => openTask(t.id)} className="block w-full text-start">
                <span className="block truncate t-sub font-semibold text-label-3 line-through">{t.title}</span>
                <span className="block t-cap text-label-3">{fmt.time(t.dueAt!)} · خلصت</span>
              </button>
            </Stop>
          </motion.div>
        ))}
      </AnimatePresence>

      {/* live «now» marker */}
      <Stop top={done.length ? "done" : "none"} bottom={stops.length ? "flow" : "none"}
        station={
          <span className="relative grid size-8 place-items-center">
            <span className="runway-beacon !size-full" />
            <span className="relative grid size-8 place-items-center rounded-full bg-accent text-[10px] font-bold text-white shadow-[0_0_18px_rgb(var(--accent-rgb)/0.7)]">الآن</span>
            <AnimatePresence>
              {bursts.map((id) => (
                <motion.span key={id} className="pointer-events-none absolute inset-0 rounded-full border-2 border-accent"
                  initial={{ scale: 0.6, opacity: 1 }} animate={{ scale: 4, opacity: 0 }} exit={{ opacity: 0 }} transition={{ duration: 1.4 }} />
              ))}
            </AnimatePresence>
          </span>
        }>
        <div className="flex items-center gap-2">
          <span className="metro-now-line h-0.5 flex-1" />
          <span className="rounded-full bg-[rgb(var(--accent-rgb)/0.16)] px-2.5 py-0.5 t-cap font-semibold text-accent num">{fmt.time(now)}</span>
        </div>
      </Stop>

      <AnimatePresence initial={false}>
        {stops.map(({ t, min, color }, i) => {
          const first = i === 0;
          const near = min <= 60;
          const frac = first ? Math.max(0, Math.min(1, 1 - min / 60)) : 0; // last-hour approach ring
          const last = i === stops.length - 1 && !more;
          return (
            <motion.div key={t.id} layout initial={{ opacity: 0, x: -24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 24, height: 0 }}>
              <Stop top={first ? "flow" : "idle"} bottom={last ? "none" : "idle"}
                station={
                  <span className="relative grid size-7 place-items-center">
                    <svg viewBox="0 0 28 28" className="absolute inset-0 -rotate-90" aria-hidden>
                      <circle cx="14" cy="14" r="11.5" fill="var(--bg)" stroke={color} strokeOpacity={first ? 0.3 : 1} strokeWidth="3" />
                      {first && <circle cx="14" cy="14" r="11.5" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" pathLength={100} strokeDasharray={`${(frac * 100).toFixed(1)} 100`} className="transition-[stroke-dasharray] duration-1000 ease-linear" />}
                    </svg>
                  </span>
                }>
                <button type="button" onClick={() => openTask(t.id)}
                  className={cx("glass-strong flex w-full items-center gap-2 rounded-2xl px-3 py-2 text-start", first && near && "metro-next")}
                  style={{ ["--car" as string]: color }}>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate t-sub font-semibold">{t.title}</span>
                    <span className="block t-cap text-label-2">{fmt.relDay(t.dueAt!, now) === "اليوم" ? "" : `${fmt.relDay(t.dueAt!, now)} · `}{fmt.time(t.dueAt!)}</span>
                  </span>
                  <span className={cx("shrink-0 t-callout font-bold num", near ? "text-ios-orange" : "text-label-2")} title={eta(min)}>{short(min)}</span>
                </button>
              </Stop>
            </motion.div>
          );
        })}
      </AnimatePresence>

      {more > 0 && (
        <Stop top="idle" bottom="none" station={<span className="size-2.5 rounded-full bg-label-3" />}>
          <p className="t-cap text-label-2">و{fmt.num(more)} محطات كمان بعدها</p>
        </Stop>
      )}
    </div>
  );
}
