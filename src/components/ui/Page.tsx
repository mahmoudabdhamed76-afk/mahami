"use client";
import { ChevronRight } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useUI } from "@/client/ui";
import { cx, Press } from "./primitives";

/**
 * iOS page: large title that collapses into a centered inline title on a
 * glass navigation bar as you scroll.
 */
export function Page({ title, subtitle, back, actions, headerExtra, children, accessory }: {
  title: ReactNode; subtitle?: ReactNode; back?: string; actions?: ReactNode; headerExtra?: ReactNode; children: ReactNode; accessory?: ReactNode;
}) {
  const [scrolled, setScrolled] = useState(false);
  const pop = useUI((s) => s.pop);
  return (
    <div className="absolute inset-0 flex flex-col">
      <header
        className={cx(
          "absolute inset-x-0 top-0 z-20 pt-safe transition-[background,box-shadow,backdrop-filter] duration-300",
          scrolled ? "glass-strong !rounded-none !border-x-0 !border-t-0 shadow-none" : "border-b border-transparent",
        )}
      >
        <div className="mx-auto grid h-12 max-w-3xl grid-cols-[1fr_auto_1fr] items-center px-2 lg:px-6">
          <div className="justify-self-start">
            {back && (
              <Press onClick={pop} scale={0.92} className="flex items-center gap-0.5 rounded-full py-1.5 pe-3 ps-1 text-accent" aria-label={`رجوع إلى ${back}`}>
                <ChevronRight size={26} strokeWidth={2.4} />
                <span className="t-body">{back}</span>
              </Press>
            )}
          </div>
          <div className={cx("max-w-[52vw] truncate t-headline transition-all duration-200", scrolled ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1")}>{title}</div>
          <div className="flex items-center gap-1 justify-self-end">{actions}</div>
        </div>
        {accessory && scrolled && <div className="mx-auto max-w-3xl px-4 pb-2 lg:px-6">{accessory}</div>}
      </header>
      <div className="scroll-y relative z-10 flex-1" onScroll={(e) => setScrolled(e.currentTarget.scrollTop > 36)}>
        <div className="mx-auto max-w-3xl px-4 pb-36 pt-[calc(env(safe-area-inset-top)+3.25rem)] lg:px-6 lg:pb-16">
          <div className="mb-3 px-1">
            <h1 className="t-large">{title}</h1>
            {subtitle && <div className="mt-0.5 t-sub text-label-2">{subtitle}</div>}
          </div>
          {headerExtra}
          {children}
        </div>
      </div>
    </div>
  );
}
