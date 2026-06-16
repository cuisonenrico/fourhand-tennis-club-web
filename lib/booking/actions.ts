"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { confirmBookingSchema, holdSchema } from "@/lib/validation";
import { sendBookingEmails, sendCancellationEmail } from "@/lib/email/send";
import type { Court, Slot, ConfirmBookingResult } from "@/lib/supabase/types";

export type HoldResult =
  | { ok: true; expiresAt: string }
  | { ok: false; error: "unavailable" | "invalid" };

export type ConfirmResult =
  | { status: "confirmed"; bookingId: string; cancelToken: string; priceCents: number }
  | { status: "slot_taken" }
  | { status: "error"; message: string };

/** Place a short-lived hold when the player opens checkout. */
export async function holdSlotAction(input: unknown): Promise<HoldResult> {
  const parsed = holdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };

  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("hold_slot", {
    p_slot_id: parsed.data.slot_id,
    p_hold_key: parsed.data.hold_key,
    p_minutes: 5,
  });

  if (error) {
    console.error("[holdSlotAction] hold_slot rpc error:", error);
    return { ok: false, error: "unavailable" };
  }
  return { ok: true, expiresAt: data as string };
}

/** Confirm the booking atomically, then queue confirmation + staff emails. */
export async function confirmBookingAction(input: unknown): Promise<ConfirmResult> {
  const parsed = confirmBookingSchema.safeParse(input);
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Invalid details" };
  }
  const v = parsed.data;
  const supabase = createAdminClient();

  const { data, error } = await supabase.rpc("confirm_booking", {
    p_slot_id: v.slot_id,
    p_hold_key: v.hold_key,
    p_guest_name: v.guest_name,
    p_guest_email: v.guest_email,
    p_guest_phone: v.guest_phone,
    p_idempotency_key: v.idempotency_key,
  });

  if (error) {
    console.error("[confirmBookingAction] confirm_booking rpc error:", error);
    return { status: "error", message: "We couldn't confirm that slot. Please try again." };
  }

  console.info("[confirmBookingAction] confirm_booking returned:", JSON.stringify(data));
  const result = (Array.isArray(data) ? data[0] : data) as ConfirmBookingResult | undefined;
  if (!result || result.status === "slot_taken") {
    return { status: "slot_taken" };
  }

  // Fetch details for the email; failure here must not undo the booking.
  try {
    const { data: slot } = await supabase
      .from("slots")
      .select("starts_at,ends_at,court_id")
      .eq("id", v.slot_id)
      .single<Pick<Slot, "starts_at" | "ends_at" | "court_id">>();
    const { data: court } = slot
      ? await supabase.from("courts").select("name").eq("id", slot.court_id).single<Pick<Court, "name">>()
      : { data: null };

    if (slot && court) {
      await sendBookingEmails({
        courtName: court.name,
        startsAt: slot.starts_at,
        endsAt: slot.ends_at,
        guestName: v.guest_name,
        guestEmail: v.guest_email,
        guestPhone: v.guest_phone,
        priceCents: result.price_cents,
        cancelToken: result.cancel_token,
      });
    }
  } catch (err) {
    console.error("[confirmBookingAction] email step failed:", err);
  }

  return {
    status: "confirmed",
    bookingId: result.booking_id,
    cancelToken: result.cancel_token,
    priceCents: result.price_cents,
  };
}

export type CancelResult =
  | { status: "cancelled" | "already_cancelled" }
  | { status: "error"; message: string };

/** Cancel by emailed token and notify the player. */
export async function cancelBookingAction(cancelToken: string): Promise<CancelResult> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("cancel_booking", { p_cancel_token: cancelToken });
  if (error) return { status: "error", message: "We couldn't cancel that booking." };

  const row = (Array.isArray(data) ? data[0] : data) as
    | { slot_id: string; court_id: string; guest_email: string; status: string }
    | undefined;
  if (!row) return { status: "error", message: "Booking not found." };
  if (row.status === "already_cancelled") return { status: "already_cancelled" };

  try {
    const { data: slot } = await supabase
      .from("slots")
      .select("starts_at,ends_at")
      .eq("id", row.slot_id)
      .single<Pick<Slot, "starts_at" | "ends_at">>();
    const { data: court } = await supabase
      .from("courts")
      .select("name")
      .eq("id", row.court_id)
      .single<Pick<Court, "name">>();
    const { data: booking } = await supabase
      .from("bookings")
      .select("guest_name")
      .eq("cancel_token", cancelToken)
      .single<{ guest_name: string }>();

    if (slot && court && booking) {
      await sendCancellationEmail({
        courtName: court.name,
        startsAt: slot.starts_at,
        endsAt: slot.ends_at,
        guestName: booking.guest_name,
        guestEmail: row.guest_email,
      });
    }
  } catch (err) {
    console.error("[cancelBookingAction] email step failed:", err);
  }

  return { status: "cancelled" };
}
