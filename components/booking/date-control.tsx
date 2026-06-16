"use client";

import { cn, todayKey } from "@/lib/utils";

function label(dateKey: string): { weekday: string; day: string } {
  const d = new Date(`${dateKey}T00:00:00+08:00`);
  const weekday = new Intl.DateTimeFormat("en-PH", { weekday: "short", timeZone: "Asia/Manila" }).format(d);
  const day = new Intl.DateTimeFormat("en-PH", { day: "numeric", month: "short", timeZone: "Asia/Manila" }).format(d);
  return { weekday, day };
}

/** Horizontal day picker (Plan §7.2) — moves across days without leaving the panel. */
export function DateControl({
  dateKeys,
  value,
  onChange,
}: {
  dateKeys: string[];
  value: string;
  onChange: (dateKey: string) => void;
}) {
  const today = todayKey();
  return (
    <div className="flex gap-2 overflow-x-auto pb-2" role="tablist" aria-label="Choose a date">
      {dateKeys.map((key) => {
        const { weekday, day } = label(key);
        const active = key === value;
        return (
          <button
            key={key}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(key)}
            className={cn(
              "flex min-w-16 shrink-0 flex-col items-center rounded-xl border px-3 py-2 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green",
              active ? "border-green bg-green text-white" : "border-surface bg-white text-charcoal hover:border-green/50",
            )}
          >
            <span className={cn("text-[11px] font-medium", active ? "text-white/90" : "text-charcoal/60")}>
              {key === today ? "Today" : weekday}
            </span>
            <span className="text-sm font-semibold">{day}</span>
          </button>
        );
      })}
    </div>
  );
}
