"use client";
import { AnimatePresence, motion } from "motion/react";
import { useUI } from "@/client/ui";
import { cx } from "../ui/primitives";
import type { BodyProps } from "../TaskRunway";
import { useEta } from "./core";

const SPAN_MIN = 12 * 60;           // the dial shows the next 12 hours
const TRACKS = [36, 30.5, 25, 19.5]; // arc radii, outer → inner
const RIM = 43;

/** Clock angle (deg, clockwise from 12) of a local time. Cumulative so the hand never jumps back. */
const clockDeg = (ms: number) => ((ms - new Date(ms).getTimezoneOffset() * 60000) / 3_600_000) * 30;
const pt = (deg: number, r: number) => { const a = (deg * Math.PI) / 180; return [50 + r * Math.sin(a), 50 - r * Math.cos(a)] as const; };
function arc(from: number, sweep: number, r: number) {
  const s = Math.max(0.6, Math.min(359.4, sweep));
  const [x0, y0] = pt(from, r), [x1, y1] = pt(from + s, r);
  return `M${x0.toFixed(3)} ${y0.toFixed(3)}A${r} ${r} 0 ${s > 180 ? 1 : 0} 1 ${x1.toFixed(3)} ${y1.toFixed(3)}`;
}

/** Orbit: a 12-hour clock face; each task is an arc from the hand to its hour that shrinks as time passes. */
export function OrbitBody({ riding, bursts, now }: BodyProps) {
  const { eta, short, fmt } = useEta();
  const openTask = useUI((s) => s.openTask);
  const inDial = riding.filter((x) => x.min <= SPAN_MIN);
  const tracked = inDial.slice(0, TRACKS.length);
  const rimOnly = inDial.slice(TRACKS.length);
  const beyond = riding.length - inDial.length;
  const hand = clockDeg(now);
  const next = riding[0];

  return (
    <div className="runway rounded-[26px] p-3">
      <div className="relative mx-auto aspect-square w-full max-w-[340px]">
        <svg viewBox="0 0 100 100" className="absolute inset-0 size-full">
          <defs>
            <radialGradient id="orbit-face"><stop offset="0" stopColor="rgb(var(--accent-rgb))" stopOpacity=".14" /><stop offset="1" stopColor="rgb(var(--accent-rgb))" stopOpacity="0" /></radialGradient>
          </defs>
          <circle cx="50" cy="50" r="48" fill="url(#orbit-face)" />
          <circle cx="50" cy="50" r={RIM + 3} fill="none" stroke="var(--separator)" strokeWidth=".4" />
          {/* minute + hour ticks */}
          {Array.from({ length: 60 }, (_, i) => {
            const hour = i % 5 === 0;
            const [x0, y0] = pt(i * 6, RIM + 3), [x1, y1] = pt(i * 6, RIM + (hour ? 0.2 : 1.6));
            return <line key={i} x1={x0} y1={y0} x2={x1} y2={y1} stroke={hour ? "var(--label-2)" : "var(--label-3)"} strokeWidth={hour ? 0.7 : 0.3} strokeLinecap="round" />;
          })}
          {Array.from({ length: 12 }, (_, i) => {
            const [x, y] = pt(i * 30, RIM - 4.2);
            return <text key={i} x={x} y={y + 1.3} textAnchor="middle" fontSize="3.6" fontWeight="600" fill="var(--label-3)">{fmt.num(i === 0 ? 12 : i)}</text>;
          })}
          {/* track guides */}
          {tracked.map((_, i) => <circle key={i} cx="50" cy="50" r={TRACKS[i]} fill="none" stroke="var(--fill)" strokeWidth="3.2" />)}
          {/* task arcs: from the hand to the task's hour */}
          {tracked.map(({ t, min, color }, i) => {
            const sweep = (min / SPAN_MIN) * 360;
            const [ex, ey] = pt(hand + sweep, TRACKS[i]);
            return (
              <g key={t.id} className="cursor-pointer" onClick={() => openTask(t.id)}>
                <path d={arc(hand, sweep, TRACKS[i])} fill="none" stroke={color} strokeWidth="3.2" strokeLinecap="round" opacity=".9" />
                <circle cx={ex} cy={ey} r="2.6" fill="#fff" />
                <circle cx={ex} cy={ey} r="1.5" fill={color} className={cx(min <= 15 && "orbit-near")} />
              </g>
            );
          })}
          {/* tasks without a track: dots on the rim */}
          {rimOnly.map(({ t, min, color }) => {
            const [x, y] = pt(hand + (min / SPAN_MIN) * 360, RIM + 3);
            return <circle key={t.id} cx={x} cy={y} r="1.6" fill={color} stroke="#fff" strokeWidth=".5" className="cursor-pointer" onClick={() => openTask(t.id)} />;
          })}
          {/* the hand */}
          <g className="orbit-hand" style={{ transform: `rotate(${hand}deg)` }}>
            <line x1="50" y1="52" x2="50" y2={50 - RIM - 1} stroke="rgb(var(--accent-rgb))" strokeWidth="1" strokeLinecap="round" />
            <circle cx="50" cy={50 - RIM - 1} r="1.6" fill="rgb(var(--accent-rgb))" />
          </g>
          <circle cx="50" cy="50" r="15" fill="var(--glass-strong)" stroke="var(--glass-border)" strokeWidth=".4" />
        </svg>

        {/* centre readout */}
        <button type="button" onClick={() => next && openTask(next.t.id)}
          className="absolute left-1/2 top-1/2 flex w-[28%] -translate-x-1/2 -translate-y-1/2 flex-col items-center text-center leading-tight">
          {next ? (
            <>
              <span className="t-cap text-label-2">الجاية</span>
              <span className="w-full truncate t-cap font-semibold">{next.t.title}</span>
              <span className={cx("t-headline num", next.min <= 15 ? "text-ios-orange" : "text-accent")}>{short(next.min)}</span>
            </>
          ) : <span className="t-cap font-semibold text-accent">الآن</span>}
        </button>
        <AnimatePresence>
          {bursts.map((id) => (
            <motion.span key={id} className="pointer-events-none absolute left-1/2 top-1/2 size-[30%] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-accent"
              initial={{ scale: 0.8, opacity: 1 }} animate={{ scale: 3, opacity: 0 }} exit={{ opacity: 0 }} transition={{ duration: 1.4 }} />
          ))}
        </AnimatePresence>
      </div>

      {/* legend */}
      {tracked.length > 0 && (
        <div className="mt-2 grid gap-1">
          {tracked.map(({ t, min, color }) => (
            <button key={t.id} type="button" onClick={() => openTask(t.id)} className="flex items-center gap-2 rounded-xl px-2 py-1 text-start active:bg-fill">
              <span className="h-1 w-4 shrink-0 rounded-full" style={{ background: color }} />
              <span className="min-w-0 flex-1 truncate t-foot font-semibold">{t.title}</span>
              <span className="shrink-0 t-cap text-label-2 num">{fmt.time(t.dueAt!)} · {eta(min)}</span>
            </button>
          ))}
        </div>
      )}
      {(rimOnly.length > 0 || beyond > 0) && (
        <p className="mt-1 px-2 t-cap text-label-3">
          {rimOnly.length > 0 && <>{fmt.num(rimOnly.length)} كمان على الإطار</>}
          {rimOnly.length > 0 && beyond > 0 && " · "}
          {beyond > 0 && <>{fmt.num(beyond)} بعد ١٢ ساعة</>}
        </p>
      )}
    </div>
  );
}
