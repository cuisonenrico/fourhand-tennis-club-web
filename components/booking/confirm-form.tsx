"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { guestSchema } from "@/lib/validation";
import { formatDateLong, formatTimeRange } from "@/lib/utils";
import type { Slot } from "@/lib/supabase/types";

const inputClass =
  "w-full rounded-xl border border-surface bg-white px-4 py-3 text-sm text-charcoal outline-none transition focus:border-green focus:ring-2 focus:ring-green/30";

export interface GuestDetails {
  guest_name: string;
  guest_email: string;
  guest_phone: string;
}

export function ConfirmForm({
  courtName,
  slot,
  priceLabel,
  submitting,
  onBack,
  onConfirm,
}: {
  courtName: string;
  slot: Slot;
  priceLabel: string;
  submitting: boolean;
  onBack: () => void;
  onConfirm: (details: GuestDetails) => void;
}) {
  const [details, setDetails] = useState<GuestDetails>({ guest_name: "", guest_email: "", guest_phone: "" });
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = guestSchema.safeParse(details);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Please check your details");
      return;
    }
    setError(null);
    onConfirm(parsed.data);
  }

  return (
    <motion.form
      onSubmit={handleSubmit}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="flex flex-col gap-4"
    >
      <button type="button" onClick={onBack} className="inline-flex w-fit items-center gap-1 text-sm font-medium text-charcoal/70 hover:text-green">
        <ArrowLeft size={16} /> Change slot
      </button>

      <div className="rounded-card bg-green-50 p-4">
        <p className="font-semibold text-charcoal">{courtName}</p>
        <p className="text-sm text-charcoal/70">{formatDateLong(slot.starts_at)}</p>
        <p className="text-sm text-charcoal/70">{formatTimeRange(slot.starts_at, slot.ends_at)} · 60 min</p>
        <p className="mt-1 text-sm font-semibold text-green-600">{priceLabel} — pay at the club</p>
      </div>

      <div className="space-y-3">
        <div>
          <label htmlFor="guest_name" className="mb-1 block text-sm font-medium text-charcoal">Name</label>
          <input id="guest_name" autoComplete="name" required className={inputClass}
            value={details.guest_name} onChange={(e) => setDetails((d) => ({ ...d, guest_name: e.target.value }))} />
        </div>
        <div>
          <label htmlFor="guest_email" className="mb-1 block text-sm font-medium text-charcoal">Email</label>
          <input id="guest_email" type="email" autoComplete="email" required className={inputClass}
            value={details.guest_email} onChange={(e) => setDetails((d) => ({ ...d, guest_email: e.target.value }))} />
        </div>
        <div>
          <label htmlFor="guest_phone" className="mb-1 block text-sm font-medium text-charcoal">Phone</label>
          <input id="guest_phone" type="tel" autoComplete="tel" required className={inputClass}
            value={details.guest_phone} onChange={(e) => setDetails((d) => ({ ...d, guest_phone: e.target.value }))} />
        </div>
      </div>

      {error && <p role="alert" className="rounded-lg bg-pink/10 px-3 py-2 text-sm text-pink">{error}</p>}

      <Button type="submit" size="lg" disabled={submitting} className="w-full">
        {submitting ? "Confirming…" : "Confirm booking"}
      </Button>
      <p className="text-center text-xs text-charcoal/50">No account needed · instant email confirmation</p>
    </motion.form>
  );
}
