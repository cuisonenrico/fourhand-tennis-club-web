"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDateLong, formatTimeRange } from "@/lib/utils";

export function BookingSuccess({
  courtName,
  startsAt,
  endsAt,
  priceLabel,
  onBookAnother,
}: {
  courtName: string;
  startsAt: string;
  endsAt: string;
  priceLabel: string;
  onBookAnother: () => void;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col items-center text-center"
    >
      <motion.span
        initial={reduce ? { opacity: 0 } : { scale: 0, rotate: -20 }}
        animate={reduce ? { opacity: 1 } : { scale: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 18, delay: 0.05 }}
        className="grid h-16 w-16 place-items-center rounded-full bg-green text-white shadow-lift"
      >
        <Check size={32} strokeWidth={3} />
      </motion.span>

      <h3 className="mt-5 text-2xl font-bold text-charcoal">You&apos;re on the court!</h3>
      <p className="mt-2 text-sm text-charcoal/70">
        A confirmation with a calendar invite is on its way to your inbox.
      </p>

      <div className="mt-5 w-full rounded-card bg-green-50 p-4 text-left">
        <p className="font-semibold text-charcoal">{courtName}</p>
        <p className="text-sm text-charcoal/70">{formatDateLong(startsAt)}</p>
        <p className="text-sm text-charcoal/70">{formatTimeRange(startsAt, endsAt)} · 60 min</p>
        <p className="mt-1 text-sm font-semibold text-green-600">{priceLabel} — pay at the club</p>
      </div>

      <Button onClick={onBookAnother} variant="outline" className="mt-6 w-full">
        Book another court
      </Button>
    </motion.div>
  );
}
