"use client";
import { motion } from "motion/react";
import { RUNWAY_STYLES, type RunwayStyle } from "@/lib/types";
import { cx } from "../ui/primitives";
import { STYLE_INFO } from "./core";

const A = "rgb(var(--accent-rgb))";

/** Tiny schematic of each style for the settings picker. */
function Thumb({ style }: { style: RunwayStyle }) {
  const common = { viewBox: "0 0 60 40", className: "h-10 w-[60px]", "aria-hidden": true } as const;
  switch (style) {
    case "lanes": return (
      <svg {...common}>{[10, 20, 30].map((y) => <line key={y} x1="4" x2="48" y1={y} y2={y} stroke="var(--separator)" strokeDasharray="3 3" />)}
        <rect x="50" y="4" width="8" height="32" rx="3" fill={A} opacity=".35" /><rect x="14" y="7" width="16" height="6" rx="3" fill="#ff9f0a" /><rect x="30" y="17" width="14" height="6" rx="3" fill={A} /><rect x="6" y="27" width="16" height="6" rx="3" fill="#30d158" /></svg>);
    case "radar": return (
      <svg {...common}><circle cx="30" cy="20" r="18" fill="none" stroke="var(--separator)" /><circle cx="30" cy="20" r="11" fill="none" stroke="var(--separator)" />
        <path d="M30 20 L30 2 A18 18 0 0 1 44 9 Z" fill={A} opacity=".45" /><circle cx="30" cy="20" r="4" fill={A} /><circle cx="39" cy="15" r="2.4" fill={A} /><circle cx="18" cy="29" r="2.4" fill="#ff9f0a" /><circle cx="42" cy="30" r="2" fill="#30d158" /></svg>);
    case "road": return (
      <svg {...common}><path d="M28 3 L32 3 L56 40 L4 40 Z" fill="var(--fill-2)" /><line x1="30" y1="6" x2="30" y2="38" stroke="var(--label-3)" strokeDasharray="3 3" />
        <rect x="31" y="9" width="7" height="4" rx="2" fill="#ff9f0a" /><rect x="14" y="24" width="16" height="8" rx="4" fill={A} /><line x1="2" x2="58" y1="36" y2="36" stroke={A} strokeWidth="1.5" /></svg>);
    case "metro": return (
      <svg {...common}><line x1="50" y1="4" x2="50" y2="38" stroke="var(--fill-2)" strokeWidth="3" /><line x1="50" y1="4" x2="50" y2="14" stroke="#30d158" strokeWidth="3" />
        <circle cx="50" cy="14" r="4" fill={A} />{[24, 33].map((y, i) => <g key={y}><circle cx="50" cy={y} r="3" fill="var(--bg)" stroke={i ? "#ff9f0a" : A} strokeWidth="1.6" /><rect x="6" y={y - 3.5} width="38" height="7" rx="3.5" fill="var(--fill-2)" /></g>)}
        <line x1="8" x2="44" y1="14" y2="14" stroke={A} strokeDasharray="2 2" /></svg>);
    case "countdown": return (
      <svg {...common}><circle cx="44" cy="20" r="14" fill="none" stroke="var(--fill-2)" strokeWidth="4" /><circle cx="44" cy="20" r="14" fill="none" stroke={A} strokeWidth="4" strokeDasharray="60 88" strokeLinecap="round" transform="rotate(-90 44 20)" />
        <rect x="4" y="9" width="22" height="5" rx="2.5" fill="var(--label-2)" /><rect x="4" y="18" width="14" height="4" rx="2" fill="var(--label-3)" /><rect x="4" y="26" width="10" height="6" rx="3" fill="#30d158" /></svg>);
    case "orbit": return (
      <svg {...common}><circle cx="30" cy="20" r="18" fill="none" stroke="var(--separator)" />
        <path d="M30 6 A14 14 0 0 1 43 25" fill="none" stroke={A} strokeWidth="2.6" strokeLinecap="round" /><path d="M30 10 A10 10 0 1 1 21 25" fill="none" stroke="#ff9f0a" strokeWidth="2.6" strokeLinecap="round" />
        <line x1="30" y1="20" x2="30" y2="3" stroke={A} strokeWidth="1.2" /><circle cx="30" cy="20" r="4" fill="var(--glass-strong)" stroke="var(--separator)" /></svg>);
    case "capsules": return (
      <svg {...common}>{[[8, .75, A], [24, .45, "#ff9f0a"], [40, .2, "#30d158"]].map(([x, f, c]) => (
        <g key={x as number}><rect x={x as number} y="3" width="12" height="34" rx="6" fill="var(--fill)" stroke="var(--separator)" /><rect x={x as number} y={3 + 34 * (1 - (f as number))} width="12" height={34 * (f as number)} rx="6" fill={c as string} /></g>))}</svg>);
  }
}

export function RunwayStylePicker({ value, onChange }: { value: RunwayStyle; onChange: (s: RunwayStyle) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-4" role="radiogroup" aria-label="شكل «مهامي في الطريق»">
      {RUNWAY_STYLES.map((s) => {
        const on = s === value;
        return (
          <motion.button key={s} type="button" role="radio" aria-checked={on} whileTap={{ scale: 0.95 }} onClick={() => onChange(s)}
            className={cx("relative flex flex-col items-center gap-1 rounded-2xl px-2 pb-2 pt-3 text-center transition-colors", on ? "bg-[rgb(var(--accent-rgb)/0.13)] ring-2 ring-accent" : "bg-fill")}>
            <Thumb style={s} />
            <span className={cx("t-foot font-semibold", on && "text-accent")}>{STYLE_INFO[s].name}</span>
            <span className="t-cap leading-tight text-label-2">{STYLE_INFO[s].desc}</span>
          </motion.button>
        );
      })}
    </div>
  );
}
