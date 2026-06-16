"use client";

import { motion } from "framer-motion";
import { Lightbulb, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CourtAvailability } from "@/lib/booking/queries";

const SURFACE_LABEL: Record<string, string> = {
  hard: "Hard",
  clay: "Clay",
  grass: "Grass",
};

export function CourtTile({
  court,
  selected,
  onSelect,
}: {
  court: CourtAvailability;
  selected: boolean;
  onSelect: () => void;
}) {
  const fullyBooked = court.tileState === "fully_booked";

  return (
    <motion.button
      type="button"
      layout
      onClick={onSelect}
      disabled={fullyBooked}
      aria-pressed={selected}
      aria-label={`${court.name}, ${SURFACE_LABEL[court.surface]} ${court.environment}, ${
        fullyBooked ? "fully booked" : `${court.freeCount} slots free`
      }`}
      whileTap={fullyBooked ? undefined : { scale: 0.97 }}
      className={cn(
        "flex flex-col rounded-card border-2 p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green focus-visible:ring-offset-2",
        selected && "border-green bg-green text-white shadow-lift",
        !selected && !fullyBooked && "border-green/40 bg-white text-charcoal hover:border-green hover:shadow-soft",
        fullyBooked && "cursor-not-allowed border-transparent bg-surface text-charcoal/40",
      )}
    >
      <span className="font-semibold">{court.name}</span>

      <span className={cn("mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs", selected ? "text-white/90" : "text-charcoal/60")}>
        <span className="inline-flex items-center gap-1">
          <MapPin size={12} /> {SURFACE_LABEL[court.surface]} · {court.environment}
        </span>
        {court.lighting && (
          <span className="inline-flex items-center gap-1">
            <Lightbulb size={12} /> Lit
          </span>
        )}
      </span>

      <span
        className={cn(
          "mt-3 text-xs font-medium",
          fullyBooked ? "text-charcoal/40" : selected ? "text-white" : "text-green-600",
        )}
      >
        {fullyBooked ? "Fully booked" : `${court.freeCount} slot${court.freeCount === 1 ? "" : "s"} free`}
      </span>
    </motion.button>
  );
}
