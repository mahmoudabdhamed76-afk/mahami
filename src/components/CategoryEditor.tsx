"use client";
import { Trash2 } from "lucide-react";
import { useState } from "react";
import { createCategory, deleteCategory, updateCategory } from "@/client/actions";
import { useStore } from "@/client/store";
import { confirmDialog, useUI } from "@/client/ui";
import { CATEGORY_COLORS, CATEGORY_ICONS, CategoryIcon } from "./ui/icons";
import { cx, Press } from "./ui/primitives";
import { Sheet, SheetHeader } from "./ui/Sheet";

export function CategoryEditor() {
  const st = useUI((s) => s.categoryEditor);
  const close = useUI((s) => s.closeCategory);
  return (
    <Sheet open={!!st} onClose={close} label="القائمة">
      {st && <Body key={st.id ?? "new"} id={st.id} />}
    </Sheet>
  );
}

function Body({ id }: { id?: string }) {
  const close = useUI((s) => s.closeCategory);
  const existing = useStore((s) => (id ? s.categories[id] : undefined));
  const count = useStore((s) => (id ? Object.values(s.tasks).filter((t) => t.categoryId === id).length : 0));
  const toast = useStore((s) => s.toast);
  const [name, setName] = useState(existing?.name ?? "");
  const [color, setColor] = useState(existing?.color ?? CATEGORY_COLORS[6]);
  const [icon, setIcon] = useState(existing?.icon ?? "list");

  const save = () => {
    if (!name.trim()) return;
    if (existing) updateCategory(existing.id, { name: name.trim(), color, icon });
    else createCategory({ name, color, icon });
    close();
  };
  const remove = async () => {
    if (!existing) return;
    const ok = await confirmDialog({
      title: `حذف قائمة «${existing.name}»؟`,
      message: count ? `ستبقى ${count} مهمة بدون قائمة.` : undefined,
      confirm: "حذف القائمة", destructive: true,
    });
    if (!ok) return;
    deleteCategory(existing.id);
    close();
    useUI.setState((s) => ({ stack: s.stack.filter((r) => r.list !== `cat:${existing.id}`) }));
    toast({ text: "تم حذف القائمة", icon: "trash" });
  };

  return (
    <>
      <SheetHeader
        title={existing ? "تعديل القائمة" : "قائمة جديدة"}
        start={<button type="button" onClick={close} className="px-1 t-body text-accent">إلغاء</button>}
        end={<button type="button" onClick={save} disabled={!name.trim()} className="px-1 t-body font-semibold text-accent disabled:opacity-40">{existing ? "تم" : "إنشاء"}</button>}
      />
      <div className="scroll-y px-4 pb-[max(env(safe-area-inset-bottom),20px)]">
        <div className="glass mb-4 flex flex-col items-center gap-4 rounded-[22px] p-5">
          <CategoryIcon icon={icon} color={color} size={76} />
          <input data-autofocus value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="اسم القائمة" aria-label="اسم القائمة"
            onKeyDown={(e) => e.key === "Enter" && save()}
            className="h-12 w-full rounded-xl bg-fill px-4 text-center t-title3 outline-none placeholder:text-label-3" style={{ color }} />
        </div>
        <div className="glass mb-4 grid grid-cols-6 gap-3 rounded-[22px] p-4">
          {CATEGORY_COLORS.map((c) => (
            <Press key={c} onClick={() => setColor(c)} scale={0.86} aria-label={`اللون ${c}`} aria-pressed={c === color}
              className={cx("aspect-square rounded-full", c === color && "ring-[3px] ring-offset-[3px] ring-offset-[var(--bg)]")}
              style={{ background: c, ["--tw-ring-color" as string]: c }} />
          ))}
        </div>
        <div className="glass mb-4 grid grid-cols-6 gap-3 rounded-[22px] p-4">
          {Object.entries(CATEGORY_ICONS).map(([k, I]) => (
            <Press key={k} onClick={() => setIcon(k)} scale={0.86} aria-label={k} aria-pressed={k === icon}
              className={cx("grid aspect-square place-items-center rounded-full", k === icon ? "text-white" : "bg-fill text-label-2")}
              style={k === icon ? { background: color } : undefined}>
              <I size={20} />
            </Press>
          ))}
        </div>
        {existing && (
          <button type="button" onClick={remove} className="glass flex h-12 w-full items-center justify-center gap-2 rounded-[18px] t-callout font-semibold text-ios-red">
            <Trash2 size={18} /> حذف القائمة
          </button>
        )}
      </div>
    </>
  );
}
