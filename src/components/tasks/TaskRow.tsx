"use client";
import { AnimatePresence, motion, useMotionValue, useTransform, type PanInfo } from "motion/react";
import { Bell, Calendar, Check, ListChecks, Trash2, CheckCheck, StickyNote } from "lucide-react";
import { memo, useRef, useState, type ReactNode } from "react";
import { deleteTask, restoreTask, toggleTask } from "@/client/actions";
import { useFmt } from "@/client/format";
import { isOverdue } from "@/client/hooks";
import { useStore } from "@/client/store";
import { useUI } from "@/client/ui";
import type { SubtaskRec, TaskRec } from "@/lib/types";
import { cx, PRIORITY } from "../ui/primitives";

export function Checkbox({ checked, color, onToggle, size = 24, label }: { checked: boolean; color: string; onToggle: () => void; size?: number; label: string }) {
  return (
    <button
      type="button" role="checkbox" aria-checked={checked} aria-label={label}
      onClick={(e) => { e.stopPropagation(); onToggle(); }}
      className="relative grid shrink-0 place-items-center rounded-full p-2 -m-2"
    >
      <motion.span
        className="grid place-items-center rounded-full"
        style={{ width: size, height: size, border: `2px solid ${checked ? color : "var(--label-3)"}`, background: checked ? color : "transparent" }}
        animate={{ scale: checked ? [1, 0.82, 1.08, 1] : 1 }}
        transition={{ duration: 0.38 }}
      >
        <AnimatePresence>
          {checked && (
            <motion.span initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0, opacity: 0 }} transition={{ type: "spring", stiffness: 600, damping: 25 }}>
              <Check size={size * 0.62} strokeWidth={3.4} className="text-white" />
            </motion.span>
          )}
        </AnimatePresence>
      </motion.span>
    </button>
  );
}

const SWIPE = 96;

export const TaskRow = memo(function TaskRow({ task, subtasks, now, showCategory = true, showDate = true }: {
  task: TaskRec; subtasks?: SubtaskRec[]; now: number; showCategory?: boolean; showDate?: boolean;
}) {
  const fmt = useFmt();
  const cat = useStore((s) => (task.categoryId ? s.categories[task.categoryId] : undefined));
  const toast = useStore((s) => s.toast);
  const openTask = useUI((s) => s.openTask);
  const [pending, setPending] = useState(false);
  const dragging = useRef(false);
  const x = useMotionValue(0);
  const delWidth = useTransform(x, (v) => Math.max(v, 0));
  const delScale = useTransform(x, [0, SWIPE, SWIPE * 1.6], [0.5, 1, 1.18]);
  const doneWidth = useTransform(x, (v) => Math.max(-v, 0));
  const doneScale = useTransform(x, [0, -SWIPE, -SWIPE * 1.6], [0.5, 1, 1.18]);

  const checked = task.completed || pending;
  const color = cat?.color ?? "var(--accent)";
  const overdue = isOverdue(task, now);
  const done = subtasks?.filter((s) => s.done).length ?? 0;

  const toggle = () => {
    if (!task.completed) {
      setPending(true);
      setTimeout(() => { toggleTask(task.id); setPending(false); }, 380);
    } else toggleTask(task.id);
  };
  const remove = () => {
    const snap = deleteTask(task.id);
    if (snap) toast({ text: "تم حذف المهمة", icon: "trash", action: { label: "تراجع", run: () => restoreTask(snap) } }, 5000);
  };
  const onDragEnd = (_: unknown, i: PanInfo) => {
    setTimeout(() => (dragging.current = false), 50);
    if (i.offset.x > SWIPE) remove();
    else if (i.offset.x < -SWIPE) toggle();
  };

  const meta: ReactNode[] = [];
  if (showDate && task.dueAt) {
    meta.push(
      <span key="d" className={cx("inline-flex items-center gap-1", overdue && "text-ios-red font-medium")}>
        <Calendar size={13} />{fmt.due(task, now)}
      </span>,
    );
  } else if (!showDate && task.dueAt && !task.allDay) {
    meta.push(<span key="t" className={cx("num", overdue && "text-ios-red font-medium")}>{fmt.time(task.dueAt)}</span>);
  }
  if (task.remindAt && !task.completed && Date.parse(task.remindAt) > now) meta.push(<Bell key="r" size={13} className="text-ios-orange" aria-label="بتذكير" />);
  if (subtasks?.length) meta.push(<span key="s" className="inline-flex items-center gap-1 num"><ListChecks size={13} />{fmt.num(done)} من {fmt.num(subtasks.length)}</span>);
  if (task.notes) meta.push(<StickyNote key="n" size={13} aria-label="ملاحظات" />);
  if (showCategory && cat) meta.push(<span key="c" className="inline-flex items-center gap-1"><span className="size-2 rounded-full" style={{ background: cat.color }} />{cat.name}</span>);

  return (
    <div className="relative overflow-hidden">
      <motion.div className="absolute inset-y-0 left-0 flex items-center justify-center overflow-hidden bg-ios-red text-white" style={{ width: delWidth }} aria-hidden>
        <motion.span style={{ scale: delScale }} className="flex flex-col items-center gap-0.5 t-cap font-semibold"><Trash2 size={22} />حذف</motion.span>
      </motion.div>
      <motion.div className="absolute inset-y-0 right-0 flex items-center justify-center overflow-hidden bg-ios-green text-white" style={{ width: doneWidth }} aria-hidden>
        <motion.span style={{ scale: doneScale }} className="flex flex-col items-center gap-0.5 t-cap font-semibold"><CheckCheck size={22} />{task.completed ? "إعادة" : "تم"}</motion.span>
      </motion.div>
      <motion.div
        drag="x" dragDirectionLock dragConstraints={{ left: 0, right: 0 }} dragElastic={0.55}
        onDragStart={() => (dragging.current = true)} onDragEnd={onDragEnd} style={{ x }}
        className="relative flex cursor-pointer items-start gap-3 px-4 py-3 transition-colors active:bg-fill md:hover:bg-fill"
        onClick={() => !dragging.current && openTask(task.id)}
        role="button" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && openTask(task.id)}
        aria-label={task.title}
      >
        <div className="pt-0.5"><Checkbox checked={checked} color={color} onToggle={toggle} label={checked ? "إلغاء الإكمال" : "إكمال المهمة"} /></div>
        <div className="min-w-0 flex-1">
          <p className={cx("t-body break-words transition-colors duration-300", checked && "strike text-label-2")}>
            {task.priority > 0 && <span className="me-1 font-bold" style={{ color: PRIORITY[task.priority].color }}>{PRIORITY[task.priority].short}</span>}
            {task.title}
          </p>
          {meta.length > 0 && (
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 t-foot text-label-2">{meta}</div>
          )}
        </div>
      </motion.div>
    </div>
  );
});

export function TaskGroup({ title, tasks, subtasks, now, tone, showCategory, showDate, collapsible, defaultOpen = true, action }: {
  title?: ReactNode; tasks: TaskRec[]; subtasks: Record<string, SubtaskRec[]>; now: number; tone?: "danger";
  showCategory?: boolean; showDate?: boolean; collapsible?: boolean; defaultOpen?: boolean; action?: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const fmt = useFmt();
  return (
    <section className="mb-5">
      {title && (
        <div className="flex items-center justify-between px-4 pb-1.5">
          <button type="button" disabled={!collapsible} onClick={() => setOpen(!open)} className={cx("flex items-center gap-2 t-headline", tone === "danger" ? "text-ios-red" : "text-label")}>
            {title}
            <span className="t-foot font-medium text-label-2 num">{fmt.num(tasks.length)}</span>
            {collapsible && <motion.span animate={{ rotate: open ? 0 : 90 }} className="t-foot text-label-3">▾</motion.span>}
          </button>
          {action}
        </div>
      )}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 38 }}
            className="glass overflow-hidden rounded-[22px]"
          >
            <AnimatePresence initial={false}>
              {tasks.map((t) => (
                <motion.div key={t.id} layout="position"
                  initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                  transition={{ type: "spring", stiffness: 420, damping: 40 }}
                  className="row-sep" style={{ ["--sep-inset" as string]: "3.4rem" }}
                >
                  <TaskRow task={t} subtasks={subtasks[t.id]} now={now} showCategory={showCategory} showDate={showDate} />
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
