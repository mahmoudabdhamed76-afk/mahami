"use client";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { useUI } from "@/client/ui";
import { cx } from "../ui/primitives";
import type { BodyProps } from "../TaskRunway";
import { hash01, pos, TICKS, useEta, type RunItem } from "./core";

const SWEEP_MS = 4000;
const R_MIN = 10, R_MAX = 46; // % of the square

const place = (it: RunItem) => {
  const theta = hash01(it.t.id) * 360;
  const r = R_MIN + it.p * (R_MAX - R_MIN);
  const rad = (theta * Math.PI) / 180;
  return { theta, x: 50 + r * Math.sin(rad), y: 50 - r * Math.cos(rad) };
};

/** Radar: «الآن» at the centre, tasks close in as their time approaches; a beam sweeps and pings each one. */
export function RadarBody({ riding, bursts }: BodyProps) {
  const { eta } = useEta();
  const openTask = useUI((s) => s.openTask);
  const [sweepDelay] = useState(() => -(performance.now() % SWEEP_MS));

  // Label the nearest few, skipping ones that would collide with an already-labelled neighbour
  const placed = riding.slice(0, 24).map((it) => ({ it, ...place(it) }));
  const labelled: { x: number; y: number }[] = [];
  const withLabel = new Set<string>();
  for (const d of placed.slice(0, 4)) {
    if (labelled.some((l) => Math.abs(l.y - d.y) < 13 && (l.x > 50) === (d.x > 50))) continue;
    labelled.push(d); withLabel.add(d.it.t.id);
  }

  return (
    <div className="runway relative mx-auto aspect-square w-full max-w-[380px] overflow-hidden rounded-[26px]">
      <div className="absolute inset-[3%]">
        {/* rings + crosshair */}
        <svg viewBox="0 0 100 100" className="absolute inset-0 size-full" aria-hidden>
          <defs>
            <radialGradient id="radar-bg"><stop offset="0" stopColor="rgb(var(--accent-rgb))" stopOpacity=".18" /><stop offset="1" stopColor="rgb(var(--accent-rgb))" stopOpacity="0" /></radialGradient>
          </defs>
          <circle cx="50" cy="50" r={R_MAX + 2} fill="url(#radar-bg)" />
          {[...TICKS.map(([m]) => pos(m)), 1].map((p, i) => (
            <circle key={i} cx="50" cy="50" r={R_MIN + p * (R_MAX - R_MIN)} fill="none" stroke="var(--separator)" strokeWidth=".35" strokeDasharray={i === 3 ? undefined : "1 1.2"} />
          ))}
          <line x1="50" y1={50 - R_MAX} x2="50" y2={50 + R_MAX} stroke="var(--separator)" strokeWidth=".25" />
          <line x1={50 - R_MAX} y1="50" x2={50 + R_MAX} y2="50" stroke="var(--separator)" strokeWidth=".25" />
          {TICKS.map(([m, l]) => (
            <text key={m} x="51.2" y={50 - (R_MIN + pos(m) * (R_MAX - R_MIN)) + 3.2} fontSize="2.9" fill="var(--label-3)">{l}</text>
          ))}
        </svg>

        {/* sweeping beam */}
        <div className="radar-sweep absolute rounded-full" style={{ inset: `${50 - R_MAX}%`, animationDelay: `${sweepDelay}ms` }} aria-hidden />

        {/* centre */}
        <div className="absolute left-1/2 top-1/2 grid size-[17%] -translate-x-1/2 -translate-y-1/2 place-items-center">
          <span className="runway-beacon !size-full" />
          <span className="relative grid size-[78%] place-items-center rounded-full bg-accent t-cap font-bold text-white shadow-[0_6px_20px_-4px_rgb(var(--accent-rgb)/0.8)]">الآن</span>
          <AnimatePresence>
            {bursts.map((id) => (
              <motion.span key={id} className="pointer-events-none absolute inset-0 rounded-full border-2 border-accent"
                initial={{ scale: 0.6, opacity: 1 }} animate={{ scale: 5, opacity: 0 }} exit={{ opacity: 0 }} transition={{ duration: 1.5, ease: "easeOut" }} />
            ))}
          </AnimatePresence>
        </div>

        {/* blips */}
        <AnimatePresence>
          {placed.map(({ it, theta, x, y }) => (
            <RadarDot key={it.t.id} it={it} theta={theta} x={x} y={y} label={withLabel.has(it.t.id) ? eta(it.min) : null} onOpen={() => openTask(it.t.id)} />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

function RadarDot({ it, theta, x, y, label, onOpen }: { it: RunItem; theta: number; x: number; y: number; label: string | null; onOpen: () => void }) {
  // Sync the ping with the beam: both are phased against performance.now()
  const [delay] = useState(() => (theta / 360) * SWEEP_MS - (performance.now() % SWEEP_MS));
  const near = it.min <= 15;
  const right = x > 50 ? x < 70 : x <= 30; // label side: away from centre unless that would leave the dial
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.4 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.3 }}
      className="radar-dot absolute z-10 -translate-x-1/2 -translate-y-1/2" style={{ left: `${x}%`, top: `${y}%` }}
    >
      <button type="button" onClick={onOpen} title={`${it.t.title} — ${label ?? ""}`} aria-label={it.t.title}
        className="relative grid size-7 place-items-center" style={{ ["--car" as string]: it.color }}>
        <span className="radar-ping absolute size-3.5 rounded-full" style={{ background: it.color, animationDelay: `${delay}ms` }} />
        {near && <span className="hero-pulse absolute size-5 rounded-full" style={{ background: it.color }} />}
        <span className={cx("relative rounded-full border-2 border-white shadow", near ? "size-4" : "size-3.5")} style={{ background: it.color }} />
      </button>
      {label && (
        <button type="button" onClick={onOpen}
          className={cx("glass-strong absolute top-1/2 w-max max-w-[118px] -translate-y-1/2 rounded-xl px-2 py-1 text-start leading-tight", right ? "left-7" : "right-7")}>
          <span className="block truncate t-cap font-semibold">{it.t.title}</span>
          <span className={cx("block t-cap num", near ? "font-semibold text-ios-orange" : "text-label-2")}>{label}</span>
        </button>
      )}
    </motion.div>
  );
}
