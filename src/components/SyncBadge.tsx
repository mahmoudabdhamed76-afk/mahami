"use client";
import { Cloud, CloudOff, RefreshCw, AlertTriangle } from "lucide-react";
import { useStore } from "@/client/store";
import { sync } from "@/client/sync";
import { useFmt } from "@/client/format";
import { cx } from "./ui/primitives";

export function SyncBadge({ compact }: { compact?: boolean }) {
  const s = useStore((x) => x.sync);
  const online = useStore((x) => x.online);
  const fmt = useFmt();
  const offline = !online || s.state === "offline";
  const label = offline
    ? s.pending ? `غير متصل · ${fmt.num(s.pending)} بانتظار المزامنة` : "غير متصل — يعمل محليًا"
    : s.state === "syncing" ? "جارٍ المزامنة…"
    : s.state === "error" ? "تعذّرت المزامنة"
    : s.pending ? `${fmt.num(s.pending)} بانتظار المزامنة` : "متزامن";
  const Icon = offline ? CloudOff : s.state === "syncing" ? RefreshCw : s.state === "error" ? AlertTriangle : Cloud;
  return (
    <button
      type="button" onClick={() => void sync()} title={label} aria-label={label}
      className={cx("inline-flex items-center gap-1.5 rounded-full t-cap font-medium transition-colors",
        compact ? "size-9 justify-center" : "px-2.5 py-1 bg-fill",
        offline ? "text-ios-orange" : s.state === "error" ? "text-ios-red" : "text-label-2")}
    >
      <Icon size={compact ? 18 : 14} className={s.state === "syncing" ? "animate-spin" : ""} />
      {!compact && <span>{label}</span>}
    </button>
  );
}
