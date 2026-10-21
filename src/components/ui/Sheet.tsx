"use client";
import { AnimatePresence, motion, useDragControls, type PanInfo } from "motion/react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { cx } from "./primitives";

function useDesktop() {
  const [d, setD] = useState(false);
  useEffect(() => {
    const m = matchMedia("(min-width: 768px)");
    setD(m.matches);
    const f = () => setD(m.matches);
    m.addEventListener("change", f);
    return () => m.removeEventListener("change", f);
  }, []);
  return d;
}

/** iOS-style sheet: drag-to-dismiss bottom sheet on phones, floating glass modal on larger screens. */
export function Sheet({ open, onClose, children, label, height = "auto", className }: {
  open: boolean; onClose: () => void; children: ReactNode; label: string; height?: "auto" | "large"; className?: string;
}) {
  const controls = useDragControls();
  const desktop = useDesktop();
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    setTimeout(() => panel.current?.querySelector<HTMLElement>("[data-autofocus]")?.focus(), 260);
    return () => { window.removeEventListener("keydown", onKey); prev?.focus?.(); };
  }, [open, onClose]);

  const onDragEnd = (_: unknown, i: PanInfo) => {
    if (i.offset.y > 130 || i.velocity.y > 600) onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center md:p-6" role="dialog" aria-modal="true" aria-label={label}>
          <motion.div
            className="absolute inset-0 bg-black/25 backdrop-blur-[2px] dark:bg-black/50"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}
            onClick={onClose}
          />
          <motion.div
            ref={panel}
            className={cx(
              "glass-strong relative flex w-full flex-col overflow-hidden rounded-t-[28px] md:max-w-[560px] md:rounded-[28px]",
              height === "large" ? "h-[92dvh] md:h-auto md:max-h-[86dvh]" : "max-h-[92dvh] md:max-h-[86dvh]",
              className,
            )}
            initial={desktop ? { opacity: 0, scale: 0.94, y: 12 } : { y: "100%" }}
            animate={desktop ? { opacity: 1, scale: 1, y: 0 } : { y: 0 }}
            exit={desktop ? { opacity: 0, scale: 0.96, y: 8 } : { y: "100%" }}
            transition={{ type: "spring", stiffness: 420, damping: 40, mass: 0.9 }}
            drag={desktop ? false : "y"} dragControls={controls} dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }} dragElastic={{ top: 0.04, bottom: 0.9 }} onDragEnd={onDragEnd}
          >
            <div className="flex shrink-0 cursor-grab touch-none justify-center pb-1 pt-2 md:hidden" onPointerDown={(e) => controls.start(e)}>
              <span className="h-[5px] w-9 rounded-full bg-label-3" />
            </div>
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

/** Sheet header row with cancel/confirm like iOS modal navigation bars. Also acts as a drag handle. */
export function SheetHeader({ title, start, end }: { title: ReactNode; start?: ReactNode; end?: ReactNode }) {
  return (
    <div className="grid shrink-0 grid-cols-[1fr_auto_1fr] items-center px-4 pb-2 pt-1 md:pt-4">
      <div className="justify-self-start">{start}</div>
      <h2 className="t-headline">{title}</h2>
      <div className="justify-self-end">{end}</div>
    </div>
  );
}
