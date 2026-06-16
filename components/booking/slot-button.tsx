"use client";

import { motion } from "framer-motion";
import { cn, formatTime } from "@/lib/utils";
import type { Slot } from "@/lib/supabase/types";

export function SlotButton({
  slot,
  selected,
  priceLabel,
  onSelect,
}: {
  slot: Slot;
  selected: boolean;
  priceLabel: string;
  onSelect: () => void;
}) {
  // 'held' slots held by someone else are inert, like 'booked'.
  const taken = slot.status === "booked" || (slot.status === "held" && !selected);

  return (
    <motion.button
      type="button"
      layout
      disabled={taken}
      onClick={onSelect}
      aria-pressed={selected}
      whileTap={taken ? undefined : { scale: 0.97 }}
      className={cn(
        "flex items-center justify-between rounded-xl border px-4 py-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green",
        selected && "border-green bg-green text-white shadow-lift",
        !selected && !taken && "border-green/40 bg-white text-charcoal hover:border-green hover:bg-green-50",
        taken && "cursor-not-allowed border-transparent bg-surface text-charcoal/40 line-through",
      )}
    >
      <span className="font-semibold">{formatTime(slot.starts_at)}</span>
      <span className={cn("text-xs", selected ? "text-white/90" : taken ? "text-charcoal/40" : "text-charcoal/60")}>
        {taken ? "Taken" : priceLabel}
      </span>
    </motion.button>
  );
}
