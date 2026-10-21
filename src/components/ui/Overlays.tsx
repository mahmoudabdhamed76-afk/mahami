"use client";
import { AnimatePresence, motion } from "motion/react";
import { Bell, Check, CloudOff, Trash2, CloudCheck, AlertCircle } from "lucide-react";
import { useStore } from "@/client/store";
import { useUI } from "@/client/ui";
import { Press } from "./primitives";

export function Toasts() {
  const toasts = useStore((s) => s.toasts);
  const dismiss = useStore((s) => s.dismissToast);
  const icons = { bell: Bell, check: Check, trash: Trash2, "wifi-off": CloudOff, cloud: CloudCheck };
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[70] flex flex-col items-center gap-2 px-4 pt-[max(env(safe-area-inset-top),12px)]">
      <AnimatePresence initial={false}>
        {toasts.map((t) => {
          const I = t.tone === "error" ? AlertCircle : t.icon ? icons[t.icon] : Check;
          return (
            <motion.div
              key={t.id} layout
              initial={{ opacity: 0, y: -24, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -16, scale: 0.92 }}
              transition={{ type: "spring", stiffness: 500, damping: 34 }}
              className="glass-strong pointer-events-auto flex min-h-12 w-full max-w-sm items-center gap-3 rounded-full py-2 pe-2 ps-4"
              role="status"
              drag="y" dragConstraints={{ top: 0, bottom: 0 }} onDragEnd={(_, i) => i.offset.y < -20 && dismiss(t.id)}
            >
              <I size={19} className={t.tone === "error" ? "text-ios-red" : "text-accent"} />
              <span className="min-w-0 flex-1 truncate t-sub font-medium">{t.text}</span>
              {t.action && (
                <Press onClick={() => { t.action!.run(); dismiss(t.id); }} className="rounded-full bg-[rgb(var(--accent-rgb)/0.14)] px-3.5 py-1.5 t-foot font-semibold text-accent">
                  {t.action.label}
                </Press>
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

/** iOS action-sheet confirmation. */
export function ConfirmSheet() {
  const c = useUI((s) => s.confirmState);
  return (
    <AnimatePresence>
      {c && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center p-3 md:items-center" role="alertdialog" aria-modal="true">
          <motion.div className="absolute inset-0 bg-black/30" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => c.resolve(false)} />
          <motion.div
            className="relative w-full max-w-sm space-y-2 pb-[env(safe-area-inset-bottom)]"
            initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }}
            transition={{ type: "spring", stiffness: 480, damping: 38 }}
          >
            <div className="glass-strong overflow-hidden rounded-[18px] text-center">
              <div className="px-5 py-4">
                <p className="t-foot font-semibold text-label-2">{c.title}</p>
                {c.message && <p className="mt-1 t-foot text-label-2">{c.message}</p>}
              </div>
              <button autoFocus onClick={() => c.resolve(true)} className={`h-14 w-full border-t border-separator t-body font-semibold active:bg-fill ${c.destructive ? "text-ios-red" : "text-accent"}`}>
                {c.confirm}
              </button>
            </div>
            <button onClick={() => c.resolve(false)} className="glass-strong h-14 w-full rounded-[18px] t-body font-semibold text-accent active:bg-fill">
              إلغاء
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
