"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { createClient } from "@/lib/supabase/browser";
import {
  getCourtsWithAvailability,
  getSlotsForCourt,
  type CourtAvailability,
} from "@/lib/booking/queries";
import { holdSlotAction, confirmBookingAction } from "@/lib/booking/actions";
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
  startsAt: string;
  endsAt: string;
  priceLabel: string;
}

export function CourtGrid({
  initialCourts,
  pricingRules,
  initialDateKey,
  dateKeys,
  initialCourtId,
}: {
  initialCourts: CourtAvailability[];
  pricingRules: PricingRule[];
  initialDateKey: string;
  dateKeys: string[];
  initialCourtId?: string;
}) {
  const supabase = useMemo(() => createClient(), []);

  const [dateKey, setDateKey] = useState(initialDateKey);
  const [courts, setCourts] = useState<CourtAvailability[]>(initialCourts);
  const [selectedCourtId, setSelectedCourtId] = useState<string | null>(initialCourtId ?? null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [phase, setPhase] = useState<Phase>("slots");
  const [holdKey, setHoldKey] = useState<string | null>(null);
  const [idemKey, setIdemKey] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [panelError, setPanelError] = useState<string | null>(null);
  const [success, setSuccess] = useState<SuccessInfo | null>(null);

  // Refs keep the realtime handler from closing over stale state.
  const dateRef = useRef(dateKey);
  const courtRef = useRef(selectedCourtId);
  dateRef.current = dateKey;
  courtRef.current = selectedCourtId;

  const selectedCourt = courts.find((c) => c.id === selectedCourtId) ?? null;
  const priceLabel = useCallback(
    (slot: Slot) => formatPrice(resolvePriceCents(slot.starts_at, pricingRules)),
    [pricingRules],
  );

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
        setSlots(await getSlotsForCourt(supabase, courtId, dk));
      } catch (err) {
        console.error("[booking] slot load failed:", err);
        setSlots([]);
      } finally {
        setLoadingSlots(false);
      }
    },
    [supabase],
  );

  // Live updates: a slot another player takes greys out without a refresh.
  useEffect(() => {
    const channel = supabase
      .channel("public:slots")
      .on("postgres_changes", { event: "*", schema: "public", table: "slots" }, () => {
        void refreshAvailability(dateRef.current);
        if (courtRef.current) void loadSlots(courtRef.current, dateRef.current);
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, refreshAvailability, loadSlots]);

  // Open the deep-linked court on first render.
  useEffect(() => {
    if (initialCourtId) void loadSlots(initialCourtId, initialDateKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openCourt(courtId: string) {
    setSelectedCourtId(courtId);
    setPhase("slots");
    setSelectedSlot(null);
    setPanelError(null);
    setSuccess(null);
    void loadSlots(courtId, dateKey);
  }

  function closePanel() {
    setSelectedCourtId(null);
    setPhase("slots");
    setSelectedSlot(null);
    setPanelError(null);
    setSuccess(null);
  }

  async function changeDate(dk: string) {
    setDateKey(dk);
    setSelectedSlot(null);
    setPanelError(null);
    await refreshAvailability(dk);
    if (selectedCourtId) await loadSlots(selectedCourtId, dk);
  }

  async function selectSlot(slot: Slot) {
    setPanelError(null);
    const key = crypto.randomUUID();
    const result = await holdSlotAction({ slot_id: slot.id, hold_key: key });
    if (!result.ok) {
      setPanelError("Someone just grabbed that slot. Pick another time.");
      if (selectedCourtId) await loadSlots(selectedCourtId, dateKey);
      return;
    }
    setHoldKey(key);
    setIdemKey(crypto.randomUUID());
    setSelectedSlot(slot);
    setPhase("confirm");
  }

  async function confirm(details: GuestDetails) {
    if (!selectedSlot || !holdKey || !idemKey || !selectedCourt) return;
    setSubmitting(true);
    setPanelError(null);
    const result = await confirmBookingAction({
      ...details,
      slot_id: selectedSlot.id,
      hold_key: holdKey,
      idempotency_key: idemKey,
    });
    setSubmitting(false);

    if (result.status === "confirmed") {
      setSuccess({
        courtName: selectedCourt.name,
        startsAt: selectedSlot.starts_at,
        endsAt: selectedSlot.ends_at,
        priceLabel: formatPrice(result.priceCents),
      });
      setPhase("success");
      void refreshAvailability(dateKey);
      void loadSlots(selectedCourt.id, dateKey);
    } else if (result.status === "slot_taken") {
      setPanelError("That slot was just taken. Please choose another.");
      setPhase("slots");
      await loadSlots(selectedCourt.id, dateKey);
    } else {
      setPanelError(result.message);
    }
  }

  return (
    <>
      <div className="mb-6">
        <DateControl dateKeys={dateKeys} value={dateKey} onChange={changeDate} />
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
            onChangeDate={changeDate}
            slots={slots}
            loading={loadingSlots}
            error={panelError}
            priceLabel={priceLabel}
            onSelectSlot={selectSlot}
          />
        )}

        {phase === "confirm" && selectedSlot && selectedCourt && (
          <ConfirmForm
            courtName={selectedCourt.name}
            slot={selectedSlot}
            priceLabel={priceLabel(selectedSlot)}
            submitting={submitting}
            onBack={() => setPhase("slots")}
            onConfirm={confirm}
          />
        )}

        {phase === "success" && success && (
          <BookingSuccess
            courtName={success.courtName}
            startsAt={success.startsAt}
            endsAt={success.endsAt}
            priceLabel={success.priceLabel}
            onBookAnother={closePanel}
          />
        )}
      </AvailabilityPanel>
    </>
  );
}

function SlotsView({
  dateKeys,
  dateKey,
  onChangeDate,
  slots,
  loading,
  error,
  priceLabel,
  onSelectSlot,
}: {
  dateKeys: string[];
  dateKey: string;
  onChangeDate: (dk: string) => void;
  slots: Slot[];
  loading: boolean;
  error: string | null;
  priceLabel: (slot: Slot) => string;
  onSelectSlot: (slot: Slot) => void;
}) {
  return (
    <div>
      <DateControl dateKeys={dateKeys} value={dateKey} onChange={onChangeDate} />

      {error && <p role="alert" className="mt-3 rounded-lg bg-pink/10 px-3 py-2 text-sm text-pink">{error}</p>}

      <div className="mt-4">
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
              <p className="py-8 text-center text-sm text-charcoal/60">
                No slots for this day. Try another date.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {slots.map((slot) => (
                  <SlotButton
                    key={slot.id}
                    slot={slot}
                    selected={false}
                    priceLabel={priceLabel(slot)}
                    onSelect={() => onSelectSlot(slot)}
                  />
                ))}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
