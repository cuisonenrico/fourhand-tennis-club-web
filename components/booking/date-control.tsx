"use client";

import { CalendarDays } from "lucide-react";
import { cn, todayKey } from "@/lib/utils";

function label(dateKey: string): { weekday: string; day: string } {
  const d = new Date(`${dateKey}T00:00:00+08:00`);
  const weekday = new Intl.DateTimeFormat("en-PH", { weekday: "short", timeZone: "Asia/Manila" }).format(d);
  const day = new Intl.DateTimeFormat("en-PH", { day: "numeric", month: "short", timeZone: "Asia/Manila" }).format(d);
  return { weekday, day };
}

/**
 * Day picker (Plan §7.2). Quick chips for the near term plus a date input to
 * book further ahead, up to `maxDateKey`. Re-renders availability in place.
 */
export function DateControl({
  dateKeys,
  value,
  onChange,
  maxDateKey,
}: {
  dateKeys: string[];
  value: string;
  onChange: (dateKey: string) => void;
  maxDateKey: string;
}) {
  const today = todayKey();
  const valueInChips = dateKeys.includes(value);

  return (
    <div className="space-y-2">
      <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Choose a date">
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

        <label
          className={cn(
            "flex min-w-16 shrink-0 cursor-pointer flex-col items-center justify-center rounded-xl border px-3 py-2 text-center transition-colors focus-within:ring-2 focus-within:ring-green hover:border-green/50",
            !valueInChips ? "border-green bg-green text-white" : "border-dashed border-charcoal/30 bg-white text-charcoal/70",
          )}
          title="Pick another date"
        >
          <CalendarDays size={16} />
          <span className="mt-0.5 text-[11px] font-medium">{valueInChips ? "More" : label(value).day}</span>
          <input
            type="date"
            className="sr-only"
            min={today}
            max={maxDateKey}
            value={value}
            onChange={(e) => e.target.value && onChange(e.target.value)}
          />
        </label>
      </div>
    </div>
  );
}
