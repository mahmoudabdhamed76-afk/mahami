"use client";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useRef } from "react";
import { useUI } from "@/client/ui";
import { cx } from "../ui/primitives";
import type { BodyProps } from "../TaskRunway";
import { HORIZON_MIN, TICKS, useEta, usePrefersReducedMotion } from "./core";

const H = 300;          // px
const HORIZON = 54;     // px — vanishing line
const NOW_Y = H - 46;   // px — where tasks "arrive"
const K = 4;            // perspective strength
const HALF = 46;        // % road half-width at the now line
const DASHES = 9;

const depth = (p: number) => 1 / (1 + p * K);                  // 1 near → 1/5 far
/** Road distance: sqrt of time over the 48h horizon spreads hours better than the shared log scale. */
const dist = (min: number) => Math.min(1, Math.sqrt(Math.max(0, min) / HORIZON_MIN));
const yAt = (p: number) => HORIZON + (NOW_Y - HORIZON) * depth(p);

/** Road: a perspective highway; tasks drive in from the horizon and grow until they reach you. */
export function RoadBody({ riding, bursts }: BodyProps) {
  const { eta, hhmm } = useEta();
  const openTask = useUI((s) => s.openTask);
  const reduce = usePrefersReducedMotion();
  const dashRef = useRef<SVGPathElement>(null);

  // Animated centre dashes, moving toward the viewer (direct DOM, no re-render)
  useEffect(() => {
    const el = dashRef.current;
    if (!el) return;
    let raf = 0;
    const draw = (t: number) => {
      const phase = reduce ? 0 : (t / 1400) % 1;
      let d = "";
      for (let i = 0; i < DASHES + 1; i++) {
        const a = (i + 1 - phase) / DASHES, b = a - 0.45 / DASHES;
        if (b > 1) continue;
        const pa = Math.min(1, a), pb = Math.max(0, b);
        const ya = yAt(pa), yb = Math.min(H, yAt(pb) + (pb === 0 ? 30 : 0));
        const wa = 0.5 * depth(pa) + 0.05, wb = 0.5 * depth(pb) + 0.05;
        d += `M${50 - wa} ${ya}L${50 + wa} ${ya}L${50 + wb} ${yb}L${50 - wb} ${yb}Z`;
      }
      el.setAttribute("d", d);
      if (!reduce) raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [reduce]);

  // Two lanes; each car goes to the lane whose previous car is further away on screen
  const cars = useMemo(() => {
    const lastY = [-1e9, -1e9];
    return riding.slice(0, 14).map((it) => {
      const d = dist(it.min), s = depth(d), y = yAt(d);
      const lane = Math.abs(y - lastY[0]) >= Math.abs(y - lastY[1]) ? 0 : 1;
      lastY[lane] = y;
      return { it, s, y, x: 50 + (lane ? 1 : -1) * HALF * 0.48 * s };
    });
  }, [riding]);

  const edge = (p: number) => HALF * depth(p) + 0.6;
  const road = `M${50 - 0.8} ${HORIZON}L${50 + 0.8} ${HORIZON}L${50 + HALF * 1.18} ${H}L${50 - HALF * 1.18} ${H}Z`;

  return (
    <div className="runway road relative overflow-hidden rounded-[26px]" style={{ height: H }}>
      <div className="road-sky absolute inset-x-0 top-0" style={{ height: HORIZON + 40 }} aria-hidden />
      <svg viewBox={`0 0 100 ${H}`} preserveAspectRatio="none" className="absolute inset-0 size-full" aria-hidden>
        <defs>
          <linearGradient id="road-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--fill)" stopOpacity=".4" /><stop offset="1" stopColor="var(--fill-2)" />
          </linearGradient>
        </defs>
        <path d={road} fill="url(#road-fill)" />
        <path d={`M${50 - 0.8} ${HORIZON}L${50 - HALF * 1.18} ${H}M${50 + 0.8} ${HORIZON}L${50 + HALF * 1.18} ${H}`} stroke="var(--separator)" strokeWidth=".4" vectorEffect="non-scaling-stroke" fill="none" />
        {TICKS.map(([m]) => { const p = dist(m), y = yAt(p); return <line key={m} x1={50 - edge(p)} x2={50 + edge(p)} y1={y} y2={y} stroke="var(--separator)" strokeDasharray="2 3" vectorEffect="non-scaling-stroke" strokeWidth="1" />; })}
        <path ref={dashRef} fill="var(--label-3)" />
        <line x1="2" x2="98" y1={NOW_Y} y2={NOW_Y} stroke="rgb(var(--accent-rgb))" strokeWidth="2" vectorEffect="non-scaling-stroke" opacity=".85" />
      </svg>

      {/* distance labels on the road side */}
      {TICKS.map(([m, l]) => { const p = dist(m); return (
        <span key={m} className="absolute -translate-y-1/2 whitespace-nowrap t-cap text-label-3" style={{ top: yAt(p), left: `${50 + edge(p) + 2}%` }} aria-hidden>{l}</span>
      ); })}

      {/* arrival line */}
      <div className="absolute inset-x-0 flex items-center justify-center gap-1 t-cap font-bold text-accent" style={{ top: NOW_Y + 10 }}>
        <span className="road-now-dot" />أنت هنا · الآن
      </div>
      <AnimatePresence>
        {bursts.map((id) => (
          <motion.span key={id} className="pointer-events-none absolute left-1/2 size-10 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-accent" style={{ top: NOW_Y }}
            initial={{ scale: 0.5, opacity: 1 }} animate={{ scale: 6, opacity: 0 }} exit={{ opacity: 0 }} transition={{ duration: 1.4, ease: "easeOut" }} />
        ))}
      </AnimatePresence>

      {/* cars */}
      <AnimatePresence>
        {cars.map(({ it, s, y, x }) => {
          const near = it.min <= 15;
          const big = s > 0.3;
          return (
            <motion.div key={it.t.id} className="road-car absolute" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.4 } }}
              style={{ left: `${x}%`, top: y, zIndex: Math.round(s * 100), ["--s" as string]: (0.42 + 0.58 * s).toFixed(3), ["--car" as string]: it.color }}>
              <button type="button" onClick={() => openTask(it.t.id)} title={`${it.t.title} — ${eta(it.min)}`}
                className={cx("glass-strong flex items-center gap-2 rounded-full p-1", big && "pe-3", near && "runway-near")}
                style={{ boxShadow: `0 10px 22px -10px ${it.color}` }}>
                <span className="grid size-9 shrink-0 place-items-center rounded-full text-[11px] font-bold text-white" style={{ background: it.color }}>{hhmm(it.t.dueAt!)}</span>
                {big && (
                  <span className="min-w-0 max-w-[120px] text-start leading-tight">
                    <span className="block truncate t-sub font-semibold">{it.t.title}</span>
                    <span className={cx("block t-cap num", near ? "font-semibold text-ios-orange" : "text-label-2")}>{eta(it.min)}</span>
                  </span>
                )}
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
