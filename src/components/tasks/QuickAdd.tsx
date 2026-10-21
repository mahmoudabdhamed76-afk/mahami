"use client";
import { motion, AnimatePresence } from "motion/react";
import { ArrowUp, Bell, CalendarDays, Clock, Flag, Hash, SlidersHorizontal, Sparkles, X } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { createCategory, createTask, defaultReminder } from "@/client/actions";
import { addDays, dayKey, startOfDay } from "@/client/dates";
import { useFmt } from "@/client/format";
import { useCategories } from "@/client/hooks";
import { parseQuickAdd } from "@/client/nlp";
import { useStore } from "@/client/store";
import { useUI } from "@/client/ui";
import { CATEGORY_COLORS, CategoryIcon } from "../ui/icons";
import { cx, Press, PRIORITY } from "../ui/primitives";
import { Sheet, SheetHeader } from "../ui/Sheet";

export function QuickAdd() {
  const state = useUI((s) => s.quickAdd);
  const close = useUI((s) => s.closeQuickAdd);
  return (
    <Sheet open={!!state} onClose={close} label="إضافة مهمة" height="full">
      {state && <QuickAddBody key={JSON.stringify(state.draft ?? {})} />}
    </Sheet>
  );
}

function QuickAddBody() {
  const draft = useUI((s) => s.quickAdd?.draft);
  const close = useUI((s) => s.closeQuickAdd);
  const newTask = useUI((s) => s.newTask);
  const toast = useStore((s) => s.toast);
  const cats = useCategories();
  const fmt = useFmt();
  const [text, setText] = useState("");
  const [dayOverride, setDayOverride] = useState<string | null>(null);
  const [catId, setCatId] = useState<string | null>(draft?.categoryId ?? null);
  const [prio, setPrio] = useState<number | null>(null);

  const p = useMemo(() => parseQuickAdd(text, cats), [text, cats]);
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const [shake, setShake] = useState(false);
  const focusTitle = () => { titleRef.current?.focus(); setShake(true); navigator.vibrate?.([10, 40, 10]); setTimeout(() => setShake(false), 450); };

  // Resolve final values: explicit text tokens > quick chips > context draft
  let dueAt: Date | null = p.dueAt;
  let allDay = p.allDay;
  if (!p.hits.date && dayOverride) {
    const d = new Date(dayOverride);
    if (p.hits.time && p.dueAt) { d.setHours(p.dueAt.getHours(), p.dueAt.getMinutes(), 0, 0); allDay = false; }
    dueAt = d;
  } else if (!p.dueAt && draft?.dueAt) { dueAt = new Date(draft.dueAt); allDay = draft.allDay ?? true; }
  const priority = p.hits.priority ? p.priority : prio ?? draft?.priority ?? 0;
  const category = p.category ?? (catId ? cats.find((c) => c.id === catId) ?? null : null);
  const newCategoryName = p.hits.category && !p.category ? p.categoryName : null;

  const submit = (full = false) => {
    const title = p.title.trim();
    if (!title && !full) return;
    let categoryId = category?.id ?? null;
    const input = {
      title: title || "",
      dueAt: dueAt ? dueAt.toISOString() : null,
      allDay,
      priority: priority as 0 | 1 | 2 | 3,
      notes: draft?.notes ?? null,
      reminderOffset: p.remind && dueAt ? (allDay ? defaultReminder(dueAt.toISOString(), true) ?? -540 : 0) : undefined,
    };
    if (full) {
      newTask({ ...input, categoryId, reminderOffset: input.reminderOffset ?? undefined }, true);
      return;
    }
    if (newCategoryName) {
      categoryId = createCategory({ name: newCategoryName, color: CATEGORY_COLORS[cats.length % CATEGORY_COLORS.length], icon: "list" }).id;
    }
    createTask({ ...input, categoryId });
    toast({ text: dueAt ? `أُضيفت · ${fmt.due({ dueAt: dueAt.toISOString(), allDay })}` : "أُضيفت المهمة", icon: "check" }, 2400);
    close();
  };

  const today = startOfDay(Date.now());
  const quickDays = [
    { k: dayKey(today), label: "اليوم", d: today },
    { k: dayKey(addDays(today, 1)), label: "غدًا", d: addDays(today, 1) },
    { k: dayKey(addDays(today, 7)), label: "بعد أسبوع", d: addDays(today, 7) },
  ];

  const EXAMPLES = ["اجتماع الفريق بكرة الساعة ٥ م !عالية #العمل", "شراء خضار النهارده ٧ م #التسوق", "دفع فاتورة النت يوم الخميس ذكّرني", "مكالمة الدكتور بعد ٣ أيام الساعة ١١ ص"];

  return (
    <div className="flex h-full flex-col">
      <SheetHeader
        title="مهمة جديدة"
        start={<Press onClick={close} scale={0.88} aria-label="إغلاق" className="grid size-9 place-items-center rounded-full bg-fill text-label-2"><X size={19} /></Press>}
        end={<button type="button" onClick={() => (p.title.trim() ? submit() : focusTitle())} className={cx("px-1 t-body font-semibold text-accent", !p.title.trim() && "opacity-50")}>إضافة</button>}
      />
      <div className="scroll-y flex-1 px-5 pb-[max(env(safe-area-inset-bottom),20px)]">
        <form onSubmit={(e) => { e.preventDefault(); submit(); }}>
          <textarea
            ref={titleRef} data-autofocus value={text} onChange={(e) => setText(e.target.value)} rows={2}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
            placeholder="ماذا تريد أن تنجز؟"
            aria-label="عنوان المهمة"
            className={cx("mt-3 w-full resize-none bg-transparent text-[1.75rem] font-bold leading-snug outline-none placeholder:text-label-3 [field-sizing:content]", shake && "animate-[shake_.4s]")}
          />
        </form>

        {/* Live understanding of the sentence */}
        <div className="mt-2 flex min-h-9 flex-wrap items-center gap-1.5">
          <AnimatePresence initial={false}>
            {dueAt && (
              <Chip key="date" icon={allDay ? <CalendarDays size={14} /> : <Clock size={14} />} tone="accent">
                {fmt.due({ dueAt: dueAt.toISOString(), allDay })}
              </Chip>
            )}
            {priority > 0 && <Chip key="p" icon={<Flag size={14} />} color={PRIORITY[priority].color}>أولوية {PRIORITY[priority].label}</Chip>}
            {category && <Chip key="c" icon={<CategoryIcon icon={category.icon} color={category.color} size={16} />}>{category.name}</Chip>}
            {newCategoryName && <Chip key="nc" icon={<Hash size={14} />} tone="accent">قائمة جديدة: {newCategoryName}</Chip>}
            {p.remind && <Chip key="r" icon={<Bell size={14} />} color="var(--orange)">تذكير</Chip>}
          </AnimatePresence>
        </div>

        <p className="mb-2 mt-5 t-foot font-semibold text-label-2">الموعد</p>
        <div className="flex flex-wrap gap-2">
          {quickDays.map((q) => (
            <Toggle key={q.k} on={!p.hits.date && dayOverride === q.d.toISOString()} onClick={() => setDayOverride(dayOverride === q.d.toISOString() ? null : q.d.toISOString())}>
              {q.label}
            </Toggle>
          ))}
          <Toggle on={priority === 3} onClick={() => setPrio(priority === 3 ? 0 : 3)}><Flag size={14} /> مهم</Toggle>
        </div>

        {cats.length > 0 && (
          <>
            <p className="mb-2 mt-5 t-foot font-semibold text-label-2">القائمة</p>
            <div className="flex flex-wrap gap-2">
              {cats.map((c) => (
                <Toggle key={c.id} on={category?.id === c.id} onClick={() => setCatId(catId === c.id ? null : c.id)}>
                  <span className="size-2.5 rounded-full" style={{ background: c.color }} />{c.name}
                </Toggle>
              ))}
            </div>
          </>
        )}

        <button type="button" onClick={() => submit(true)} className="glass mt-6 flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-start">
          <SlidersHorizontal size={18} className="text-accent" />
          <span className="flex-1 t-callout">تفاصيل أكثر</span>
          <span className="t-foot text-label-2">ملاحظات · تذكير · مهام فرعية</span>
        </button>

        {!text && (
          <div className="mt-6">
            <p className="mb-2 flex items-center gap-1.5 t-foot font-semibold text-label-2"><Sparkles size={14} className="text-accent" /> اكتب بطبيعتك، وأنا أفهم الموعد والأولوية والقائمة</p>
            <div className="space-y-2">
              {EXAMPLES.map((ex) => (
                <button key={ex} type="button" onClick={() => { setText(ex); titleRef.current?.focus(); }}
                  className="block w-full rounded-2xl bg-fill px-4 py-3 text-start t-sub text-label-2 active:bg-fill-2">«{ex}»</button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-separator px-5 pb-[max(env(safe-area-inset-bottom),14px)] pt-3">
        <Press type="button" onClick={() => (p.title.trim() ? submit() : focusTitle())} className={cx("glass-pill flex h-[52px] w-full items-center justify-center gap-2 rounded-2xl t-callout font-semibold text-white", !p.title.trim() && "opacity-60")}>
          <ArrowUp size={20} strokeWidth={2.6} /> إضافة المهمة
        </Press>
      </div>
    </div>
  );
}

function Chip({ children, icon, tone, color }: { children: React.ReactNode; icon?: React.ReactNode; tone?: "accent"; color?: string }) {
  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.85 }}
      className={cx("inline-flex h-8 items-center gap-1.5 rounded-full px-3 t-foot font-semibold", tone === "accent" ? "bg-[rgb(var(--accent-rgb)/0.13)] text-accent" : "bg-fill")}
      style={color ? { color, background: `color-mix(in srgb, ${color} 14%, transparent)` } : undefined}
    >
      {icon}{children}
    </motion.span>
  );
}

function Toggle({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <Press onClick={onClick} scale={0.94}
      className={cx("inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 t-foot font-semibold transition-colors", on ? "glass-pill text-white" : "bg-fill text-label")}>
      {children}
    </Press>
  );
}
