"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDateLong, formatTime } from "@/lib/utils";

export interface SuccessSession {
  startsAt: string;
  endsAt: string;
}

export function BookingSuccess({
  courtName,
  sessions,
  priceLabel,
  onBookAnother,
}: {
  courtName: string;
  sessions: SuccessSession[];
  priceLabel: string;
  onBookAnother: () => void;
}) {
  const reduce = useReducedMotion();
  const hours = sessions.length;
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center text-center">
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
        <p className="text-sm text-charcoal/70">{sessions[0] && formatDateLong(sessions[0].startsAt)}</p>
        <ul className="mt-2 space-y-1">
          {sessions.map((s, i) => (
            <li key={i} className="text-sm text-charcoal/80">
              {formatTime(s.startsAt)} – {formatTime(s.endsAt)}
            </li>
          ))}
        </ul>
        <p className="mt-2 text-sm font-semibold text-green-600">
          {hours} hour{hours === 1 ? "" : "s"} · {priceLabel} — pay at the club
        </p>
      </div>

      <Button onClick={onBookAnother} variant="outline" className="mt-6 w-full">
        Book another court
      </Button>
    </motion.div>
  );
}
