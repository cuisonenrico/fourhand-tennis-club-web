"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { toDateKey, todayKey } from "@/lib/utils";

function shift(dateKey: string, days: number): string {
  const d = new Date(`${dateKey}T00:00:00+08:00`);
  return toDateKey(new Date(d.getTime() + days * 86400000));
}

export function AdminDateControl({
  value,
  onChange,
}: {
  value: string;
  onChange: (dateKey: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        aria-label="Previous day"
        onClick={() => onChange(shift(value, -1))}
        className="grid h-10 w-10 place-items-center rounded-lg border border-surface bg-white text-charcoal hover:bg-surface"
      >
        <ChevronLeft size={18} />
      </button>

      <input
        type="date"
        value={value}
        onChange={(e) => e.target.value && onChange(e.target.value)}
        className="h-10 rounded-lg border border-surface bg-white px-3 text-sm text-charcoal outline-none focus:border-green focus:ring-2 focus:ring-green/30"
      />

      <button
        type="button"
        aria-label="Next day"
        onClick={() => onChange(shift(value, 1))}
        className="grid h-10 w-10 place-items-center rounded-lg border border-surface bg-white text-charcoal hover:bg-surface"
      >
        <ChevronRight size={18} />
      </button>

      <button
        type="button"
        onClick={() => onChange(todayKey())}
        className="h-10 rounded-lg border border-surface bg-white px-4 text-sm font-medium text-charcoal hover:bg-surface"
      >
        Today
      </button>
    </div>
  );
}
