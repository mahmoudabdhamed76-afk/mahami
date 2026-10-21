"use client";
import { motion, type HTMLMotionProps } from "motion/react";
import { forwardRef, type ReactNode } from "react";

export const spring = { type: "spring", stiffness: 520, damping: 40, mass: 0.9 } as const;
export const softSpring = { type: "spring", stiffness: 300, damping: 32 } as const;

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

export const Press = forwardRef<HTMLButtonElement, HTMLMotionProps<"button"> & { scale?: number }>(function Press(
  { scale = 0.96, className, type = "button", ...p }, ref,
) {
  return <motion.button ref={ref} type={type} whileTap={{ scale }} transition={spring} className={cx("cursor-pointer disabled:opacity-40 disabled:pointer-events-none", className)} {...p} />;
});

export function Button({ children, variant = "primary", className, ...p }: HTMLMotionProps<"button"> & { variant?: "primary" | "tinted" | "plain" | "danger" }) {
  const v = {
    primary: "glass-pill text-white font-semibold",
    tinted: "bg-[rgb(var(--accent-rgb)/0.14)] text-accent font-semibold",
    plain: "text-accent font-medium",
    danger: "bg-[color-mix(in_srgb,var(--red)_14%,transparent)] text-ios-red font-semibold",
  }[variant];
  return (
    <Press className={cx("h-12 rounded-2xl px-5 t-callout inline-flex items-center justify-center gap-2", v, className)} {...p}>
      {children as ReactNode}
    </Press>
  );
}

export function IconButton({ label, children, className, ...p }: HTMLMotionProps<"button"> & { label: string }) {
  return (
    <Press aria-label={label} title={label} scale={0.88} className={cx("inline-flex size-9 items-center justify-center rounded-full text-accent hover:bg-fill", className)} {...p}>
      {children as ReactNode}
    </Press>
  );
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button" role="switch" aria-checked={checked} aria-label={label}
      onClick={() => onChange(!checked)}
      className={cx("relative h-[31px] w-[51px] shrink-0 rounded-full transition-colors duration-300", checked ? "bg-ios-green" : "bg-fill-2")}
    >
      <motion.span
        layout transition={spring}
        className="absolute top-[2px] size-[27px] rounded-full bg-white shadow-[0_3px_8px_rgba(0,0,0,.15),0_3px_1px_rgba(0,0,0,.06)]"
        style={{ insetInlineStart: checked ? 22 : 2 }}
      />
    </button>
  );
}

export function Segmented<T extends string | number>({ value, options, onChange, id, className }: {
  value: T; options: { value: T; label: ReactNode }[]; onChange: (v: T) => void; id: string; className?: string;
}) {
  return (
    <div role="tablist" className={cx("flex rounded-[10px] bg-fill p-[2px]", className)}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={String(o.value)} role="tab" aria-selected={active} type="button"
            onClick={() => onChange(o.value)}
            className={cx("relative flex-1 rounded-[8px] px-3 py-[6px] t-foot font-semibold transition-colors", active ? "text-label" : "text-label-2")}
          >
            {active && <motion.span layoutId={`seg-${id}`} transition={spring} className="absolute inset-0 rounded-[8px] bg-white shadow-[0_3px_8px_rgba(0,0,0,.12),0_3px_1px_rgba(0,0,0,.04)] dark:bg-[#636366]" />}
            <span className="relative z-10">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function ProgressRing({ value, size = 44, stroke = 5, color = "var(--accent)", children }: {
  value: number; size?: number; stroke?: number; color?: string; children?: ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value || 0));
  return (
    <div className="relative inline-grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--fill-2)" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c * (1 - v) }}
          transition={{ type: "spring", stiffness: 90, damping: 20 }}
        />
      </svg>
      {children && <div className="absolute inset-0 grid place-items-center">{children}</div>}
    </div>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("glass rounded-[22px]", className)}>{children}</div>;
}

export function SectionHeader({ children, action, className }: { children: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cx("flex items-end justify-between px-4 pb-1.5 pt-5", className)}>
      <h2 className="t-title3 text-label">{children}</h2>
      {action}
    </div>
  );
}

export function EmptyState({ icon, title, text, action }: { icon: ReactNode; title: string; text?: string; action?: ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={softSpring} className="flex flex-col items-center px-8 py-14 text-center">
      <div className="mb-4 grid size-20 place-items-center rounded-[28px] glass text-accent">{icon}</div>
      <p className="t-headline">{title}</p>
      {text && <p className="mt-1.5 max-w-xs t-sub text-label-2">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </motion.div>
  );
}

export function Spinner({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className="animate-spin" aria-hidden>
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeOpacity=".25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export const PRIORITY = [
  { label: "بدون", short: "", color: "var(--label-3)" },
  { label: "منخفضة", short: "!", color: "var(--accent)" },
  { label: "متوسطة", short: "!!", color: "var(--orange)" },
  { label: "عالية", short: "!!!", color: "var(--red)" },
] as const;
