"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { createClient } from "@/lib/supabase/browser";
import {
  getCourtsWithAvailability,
  getSlotsForCourt,
  type CourtAvailability,
} from "@/lib/booking/queries";
import {
  holdSlotsAction,
  confirmBookingMultiAction,
  ensureSlotsAction,
  releaseHoldAction,
} from "@/lib/booking/actions";
import {
  readPendingHold,
  writePendingHold,
  clearPendingHold,
  isHoldLive,
  type PendingHold,
} from "@/lib/booking/pending-hold";
import { resolvePriceCents } from "@/lib/pricing";
import { formatPrice, formatDateLong } from "@/lib/utils";
import type { PricingRule, Slot } from "@/lib/supabase/types";
import { CourtTile } from "./court-tile";
import { AvailabilityPanel } from "./availability-panel";
import { DateControl } from "./date-control";
import { SlotButton } from "./slot-button";
import { ConfirmForm, type GuestDetails } from "./confirm-form";
import { BookingSuccess } from "./success";

type Phase = "slots" | "confirm" | "success";

interface SuccessInfo {
  courtName: string;
  sessions: { startsAt: string; endsAt: string }[];
  priceLabel: string;
}

export function CourtGrid({
  initialCourts,
  pricingRules,
  initialDateKey,
  dateKeys,
  maxDateKey,
  initialCourtId,
}: {
  initialCourts: CourtAvailability[];
  pricingRules: PricingRule[];
  initialDateKey: string;
  dateKeys: string[];
  maxDateKey: string;
  initialCourtId?: string;
}) {
  const supabase = useMemo(() => createClient(), []);

  const [dateKey, setDateKey] = useState(initialDateKey);
  const [courts, setCourts] = useState<CourtAvailability[]>(initialCourts);
  const [selectedCourtId, setSelectedCourtId] = useState<string | null>(initialCourtId ?? null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlots, setSelectedSlots] = useState<Slot[]>([]);
  const [phase, setPhase] = useState<Phase>("slots");
  const [holdKey, setHoldKey] = useState<string | null>(null);
  const [idemKey, setIdemKey] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [holding, setHolding] = useState(false);
  const [panelError, setPanelError] = useState<string | null>(null);
  const [success, setSuccess] = useState<SuccessInfo | null>(null);
  // A hold from a previous visit that the guest left mid-checkout. Drives the
  // resume banner; only set while the hold is still live.
  const [resumable, setResumable] = useState<PendingHold | null>(null);

  const dateRef = useRef(dateKey);
  const courtRef = useRef(selectedCourtId);
  const phaseRef = useRef(phase);
  dateRef.current = dateKey;
  courtRef.current = selectedCourtId;
  phaseRef.current = phase;

  const selectedCourt = courts.find((c) => c.id === selectedCourtId) ?? null;
  const priceOf = useCallback((slot: Slot) => resolvePriceCents(slot.starts_at, pricingRules), [pricingRules]);
  const priceLabel = useCallback((slot: Slot) => formatPrice(priceOf(slot)), [priceOf]);
  const totalCents = selectedSlots.reduce((sum, s) => sum + priceOf(s), 0);

  const refreshAvailability = useCallback(
    async (dk: string) => {
      try {
        setCourts(await getCourtsWithAvailability(supabase, dk));
      } catch (err) {
        console.error("[booking] availability refresh failed:", err);
      }
    },
    [supabase],
  );

  const loadSlots = useCallback(
    async (courtId: string, dk: string) => {
      setLoadingSlots(true);
      try {
        const next = await getSlotsForCourt(supabase, courtId, dk);
        setSlots(next);
        // While picking, drop any selected slot that is no longer free.
        if (phaseRef.current === "slots") {
          setSelectedSlots((prev) => prev.filter((ps) => next.some((ns) => ns.id === ps.id && ns.status === "free")));
        }
      } catch (err) {
        console.error("[booking] slot load failed:", err);
        setSlots([]);
      } finally {
        setLoadingSlots(false);
      }
    },
    [supabase],
  );

  useEffect(() => {
    const channel = supabase
      .channel("public:slots")
      .on("postgres_changes", { event: "*", schema: "public", table: "slots" }, () => {
        void refreshAvailability(dateRef.current);
        if (courtRef.current && phaseRef.current !== "success") void loadSlots(courtRef.current, dateRef.current);
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, refreshAvailability, loadSlots]);

  useEffect(() => {
    if (initialCourtId) void loadSlots(initialCourtId, initialDateKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // On load, surface a hold the guest left mid-checkout last visit. A lapsed
  // hold is discarded silently — the slots have already freed themselves.
  useEffect(() => {
    const saved = readPendingHold();
    if (saved && isHoldLive(saved)) setResumable(saved);
    else if (saved) clearPendingHold();
  }, []);

  // Free the active hold immediately and forget it (deliberate abandon: Back,
  // closing the panel, or the resume banner's Cancel).
  const releaseActiveHold = useCallback((ids: string[], key: string | null) => {
    if (key && ids.length > 0) void releaseHoldAction({ slot_ids: ids, hold_key: key });
    clearPendingHold();
  }, []);

  function openCourt(courtId: string) {
    setSelectedCourtId(courtId);
    setPhase("slots");
    setSelectedSlots([]);
    setPanelError(null);
    setSuccess(null);
    void loadSlots(courtId, dateKey);
  }

  function closePanel() {
    // Closing the panel mid-checkout abandons the hold — free it now.
    if (phase === "confirm") releaseActiveHold(selectedSlots.map((s) => s.id), holdKey);
    setSelectedCourtId(null);
    setPhase("slots");
    setSelectedSlots([]);
    setHoldKey(null);
    setIdemKey(null);
    setPanelError(null);
    setSuccess(null);
  }

  async function changeDate(dk: string) {
    setDateKey(dk);
    setSelectedSlots([]);
    setPanelError(null);
    await ensureSlotsAction(dk);
    await refreshAvailability(dk);
    if (selectedCourtId) await loadSlots(selectedCourtId, dk);
  }

  function toggleSlot(slot: Slot) {
    if (slot.status !== "free") return;
    setPanelError(null);
    setSelectedSlots((prev) =>
      prev.some((s) => s.id === slot.id) ? prev.filter((s) => s.id !== slot.id) : [...prev, slot],
    );
  }

  async function continueToConfirm() {
    if (selectedSlots.length === 0) return;
    setHolding(true);
    setPanelError(null);
    const key = crypto.randomUUID();
    const ids = selectedSlots.map((s) => s.id);
    const result = await holdSlotsAction({ slot_ids: ids, hold_key: key });
    setHolding(false);
    if (!result.ok) {
      setPanelError("One of those times was just taken. Please adjust your selection.");
      if (selectedCourtId) await loadSlots(selectedCourtId, dateKey);
      return;
    }
    const idem = crypto.randomUUID();
    setHoldKey(key);
    setIdemKey(idem);
    setPhase("confirm");

    // Mirror the live hold so an abrupt exit can be resumed (or cancelled) later.
    if (selectedCourt) {
      writePendingHold({
        holdKey: key,
        idemKey: idem,
        expiresAt: result.expiresAt,
        courtId: selectedCourt.id,
        courtName: selectedCourt.name,
        dateKey,
        slots: selectedSlots,
      });
    }
  }

  async function confirm(details: GuestDetails) {
    if (selectedSlots.length === 0 || !holdKey || !idemKey || !selectedCourt) return;
    setSubmitting(true);
    setPanelError(null);
    const ordered = [...selectedSlots].sort((a, b) => a.starts_at.localeCompare(b.starts_at));
    const result = await confirmBookingMultiAction({
      ...details,
      slot_ids: ordered.map((s) => s.id),
      hold_key: holdKey,
      idempotency_key: idemKey,
    });
    setSubmitting(false);

    if (result.status === "confirmed") {
      clearPendingHold();
      setSuccess({
        courtName: selectedCourt.name,
        sessions: ordered.map((s) => ({ startsAt: s.starts_at, endsAt: s.ends_at })),
        priceLabel: formatPrice(result.totalPriceCents),
      });
      setPhase("success");
      void refreshAvailability(dateKey);
      void loadSlots(selectedCourt.id, dateKey);
    } else if (result.status === "slot_taken") {
      clearPendingHold();
      setPanelError("One of those times was just taken. Please choose again.");
      setPhase("slots");
      setSelectedSlots([]);
      await loadSlots(selectedCourt.id, dateKey);
    } else {
      setPanelError(result.message);
    }
  }

  // Confirm → slots: changing the selection abandons the current hold.
  function backToSlots() {
    releaseActiveHold(selectedSlots.map((s) => s.id), holdKey);
    setHoldKey(null);
    setIdemKey(null);
    setPhase("slots");
  }

  // Resume banner → jump straight back into the confirm step for the saved hold.
  function resumeHold(hold: PendingHold) {
    setResumable(null);
    setDateKey(hold.dateKey);
    setSelectedCourtId(hold.courtId);
    setSelectedSlots(hold.slots);
    setHoldKey(hold.holdKey);
    setIdemKey(hold.idemKey);
    setPanelError(null);
    setSuccess(null);
    setPhase("confirm");
    // Load the board behind the form so a later Back lands on a populated grid.
    void loadSlots(hold.courtId, hold.dateKey);
  }

  // Resume banner → drop the hold and free the slots.
  function cancelResumable(hold: PendingHold) {
    setResumable(null);
    releaseActiveHold(hold.slots.map((s) => s.id), hold.holdKey);
    void refreshAvailability(dateKey);
    if (selectedCourtId) void loadSlots(selectedCourtId, dateKey);
  }

  const orderedSelection = [...selectedSlots].sort((a, b) => a.starts_at.localeCompare(b.starts_at));

  return (
    <>
      {resumable && (
        <ResumeBanner
          hold={resumable}
          totalLabel={formatPrice(resumable.slots.reduce((sum, s) => sum + priceOf(s), 0))}
          onResume={() => resumeHold(resumable)}
          onCancel={() => cancelResumable(resumable)}
        />
      )}

      <div className="mb-6">
        <DateControl dateKeys={dateKeys} value={dateKey} onChange={changeDate} maxDateKey={maxDateKey} />
      </div>

      <motion.div layout className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-3">
        {courts.map((court) => (
          <CourtTile
            key={court.id}
            court={court}
            selected={court.id === selectedCourtId}
            onSelect={() => openCourt(court.id)}
          />
        ))}
      </motion.div>

      <AvailabilityPanel
        open={selectedCourtId !== null}
        title={selectedCourt?.name ?? "Court"}
        subtitle={phase !== "success" ? formatDateLong(`${dateKey}T00:00:00+08:00`) : undefined}
        onClose={closePanel}
      >
        {phase === "slots" && (
          <SlotsView
            dateKeys={dateKeys}
            dateKey={dateKey}
            maxDateKey={maxDateKey}
            onChangeDate={changeDate}
            slots={slots}
            loading={loadingSlots}
            error={panelError}
            priceLabel={priceLabel}
            selectedIds={new Set(selectedSlots.map((s) => s.id))}
            onToggleSlot={toggleSlot}
            selectionCount={selectedSlots.length}
            totalLabel={formatPrice(totalCents)}
            holding={holding}
            onContinue={continueToConfirm}
          />
        )}

        {phase === "confirm" && selectedCourt && orderedSelection.length > 0 && (
          <ConfirmForm
            courtName={selectedCourt.name}
            slots={orderedSelection}
            totalPriceLabel={formatPrice(totalCents)}
            submitting={submitting}
            onBack={backToSlots}
            onConfirm={confirm}
          />
        )}

        {phase === "success" && success && (
          <BookingSuccess
            courtName={success.courtName}
            sessions={success.sessions}
            priceLabel={success.priceLabel}
            onBookAnother={closePanel}
          />
        )}
      </AvailabilityPanel>
    </>
  );
}

function ResumeBanner({
  hold,
  totalLabel,
  onResume,
  onCancel,
}: {
  hold: PendingHold;
  totalLabel: string;
  onResume: () => void;
  onCancel: () => void;
}) {
  const count = hold.slots.length;
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="mb-6 flex flex-col gap-3 rounded-card border border-green/30 bg-green/5 p-4 shadow-soft sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="text-sm">
        <p className="font-semibold text-charcoal">You have a booking in progress</p>
        <p className="text-charcoal/60">
          {hold.courtName} · {count} hour{count === 1 ? "" : "s"} · {totalLabel} — held for a few more minutes.
        </p>
      </div>
      <div className="flex shrink-0 gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex h-10 items-center justify-center rounded-xl px-4 text-sm font-semibold text-charcoal/70 transition-colors hover:bg-surface"
        >
          Cancel hold
        </button>
        <button
          type="button"
          onClick={onResume}
          className="inline-flex h-10 items-center justify-center rounded-xl bg-green px-5 text-sm font-semibold text-white shadow-soft transition-all hover:bg-green-600 hover:shadow-lift active:scale-[0.98]"
        >
          Resume
        </button>
      </div>
    </motion.div>
  );
}

function SlotsView({
  dateKeys,
  dateKey,
  maxDateKey,
  onChangeDate,
  slots,
  loading,
  error,
  priceLabel,
  selectedIds,
  onToggleSlot,
  selectionCount,
  totalLabel,
  holding,
  onContinue,
}: {
  dateKeys: string[];
  dateKey: string;
  maxDateKey: string;
  onChangeDate: (dk: string) => void;
  slots: Slot[];
  loading: boolean;
  error: string | null;
  priceLabel: (slot: Slot) => string;
  selectedIds: Set<string>;
  onToggleSlot: (slot: Slot) => void;
  selectionCount: number;
  totalLabel: string;
  holding: boolean;
  onContinue: () => void;
}) {
  return (
    <div>
      <DateControl dateKeys={dateKeys} value={dateKey} onChange={onChangeDate} maxDateKey={maxDateKey} />

      <p className="mt-3 text-xs text-charcoal/60">Tap one or more times — book up to 8 hours at once.</p>
      {error && <p role="alert" className="mt-2 rounded-lg bg-pink/10 px-3 py-2 text-sm text-pink">{error}</p>}

      <div className="mt-3">
        <AnimatePresence mode="wait">
          <motion.div
            key={dateKey}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            {loading ? (
              <div className="grid grid-cols-2 gap-2">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="skeleton h-12 rounded-xl" />
                ))}
              </div>
            ) : slots.length === 0 ? (
              <p className="py-8 text-center text-sm text-charcoal/60">No slots for this day. Try another date.</p>
            ) : (
              <div className="grid grid-cols-2 gap-2 pb-24">
                {slots.map((slot) => (
                  <SlotButton
                    key={slot.id}
                    slot={slot}
                    selected={selectedIds.has(slot.id)}
                    priceLabel={priceLabel(slot)}
                    onSelect={() => onToggleSlot(slot)}
                  />
                ))}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {selectionCount > 0 && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
            className="sticky bottom-0 -mx-5 border-t border-surface bg-white/95 px-5 py-3 backdrop-blur"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm">
                <span className="font-semibold text-charcoal">
                  {selectionCount} hour{selectionCount === 1 ? "" : "s"}
                </span>
                <span className="text-charcoal/60"> · {totalLabel}</span>
              </div>
              <button
                type="button"
                onClick={onContinue}
                disabled={holding}
                className="inline-flex h-11 items-center justify-center rounded-xl bg-green px-5 text-sm font-semibold text-white shadow-soft transition-all hover:bg-green-600 hover:shadow-lift active:scale-[0.98] disabled:opacity-60"
              >
                {holding ? "Holding…" : "Continue"}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
