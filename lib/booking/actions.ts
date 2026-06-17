"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { confirmBookingMultiSchema, holdSlotsSchema, releaseHoldSchema } from "@/lib/validation";
import { sendBookingEmails, sendCancellationEmail } from "@/lib/email/send";
import { ensureSlotsForDate } from "@/lib/booking/ensure-slots";
import type { Court, Slot, ConfirmMultiResult } from "@/lib/supabase/types";

export type HoldResult =
  | { ok: true; expiresAt: string }
  | { ok: false; error: "unavailable" | "invalid" };

export type ConfirmResult =
  | { status: "confirmed"; groupId: string; cancelToken: string; totalPriceCents: number }
  | { status: "slot_taken" }
  | { status: "error"; message: string };

/** Make slots available for a future day (lazy generation within the horizon). */
export async function ensureSlotsAction(dateKey: string): Promise<void> {
  await ensureSlotsForDate(dateKey);
}

/** Place a short-lived hold on every selected slot when checkout opens. */
export async function holdSlotsAction(input: unknown): Promise<HoldResult> {
  const parsed = holdSlotsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };

  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("hold_slots", {
    p_slot_ids: parsed.data.slot_ids,
    p_hold_key: parsed.data.hold_key,
    p_minutes: 5,
  });

  if (error) {
    console.error("[holdSlotsAction] hold_slots rpc error:", error);
    return { ok: false, error: "unavailable" };
  }
  return { ok: true, expiresAt: data as string };
}

/**
 * Release a still-active hold early when the guest cancels or abandons checkout.
 * Best-effort: the timed expiry is the backstop, so failures never surface.
 */
export async function releaseHoldAction(input: unknown): Promise<void> {
  const parsed = releaseHoldSchema.safeParse(input);
  if (!parsed.success) return;

  const supabase = createAdminClient();
  const { error } = await supabase.rpc("release_hold", {
    p_slot_ids: parsed.data.slot_ids,
    p_hold_key: parsed.data.hold_key,
  });
  if (error) console.error("[releaseHoldAction] release_hold rpc error:", error);
}

/** Confirm a group of slots atomically, then queue confirmation + staff emails. */
export async function confirmBookingMultiAction(input: unknown): Promise<ConfirmResult> {
  const parsed = confirmBookingMultiSchema.safeParse(input);
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Invalid details" };
  }
  const v = parsed.data;
  const supabase = createAdminClient();

  const { data, error } = await supabase.rpc("confirm_booking_multi", {
    p_slot_ids: v.slot_ids,
    p_hold_key: v.hold_key,
    p_guest_name: v.guest_name,
    p_guest_email: v.guest_email,
    p_guest_phone: v.guest_phone,
    p_idempotency_key: v.idempotency_key,
  });

  if (error) {
    console.error("[confirmBookingMultiAction] confirm_booking_multi rpc error:", error);
    return { status: "error", message: "We couldn't confirm those times. Please try again." };
  }

  const result = (Array.isArray(data) ? data[0] : data) as ConfirmMultiResult | undefined;
  if (!result || result.status === "slot_taken") {
    return { status: "slot_taken" };
  }

  // Fetch session details for the email; failure here must not undo the booking.
  try {
    const { data: slots } = await supabase
      .from("slots")
      .select("starts_at,ends_at,court_id")
      .in("id", v.slot_ids)
      .order("starts_at");
    const courtId = (slots as Pick<Slot, "starts_at" | "ends_at" | "court_id">[] | null)?.[0]?.court_id;
    const { data: court } = courtId
      ? await supabase.from("courts").select("name").eq("id", courtId).single<Pick<Court, "name">>()
      : { data: null };

    if (slots && slots.length > 0 && court) {
      await sendBookingEmails({
        courtName: court.name,
        sessions: slots.map((s) => ({ startsAt: s.starts_at, endsAt: s.ends_at })),
        guestName: v.guest_name,
        guestEmail: v.guest_email,
        guestPhone: v.guest_phone,
        totalPriceCents: result.total_price_cents,
        cancelToken: result.cancel_token,
      });
    }
  } catch (err) {
    console.error("[confirmBookingMultiAction] email step failed:", err);
  }

  return {
    status: "confirmed",
    groupId: result.booking_group_id,
    cancelToken: result.cancel_token,
    totalPriceCents: result.total_price_cents,
  };
}

export type CancelResult =
  | { status: "cancelled" | "already_cancelled" }
  | { status: "error"; message: string };

/** Cancel an entire booking group by its emailed token and notify the player. */
export async function cancelBookingAction(cancelToken: string): Promise<CancelResult> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("cancel_booking", { p_cancel_token: cancelToken });
  if (error) {
    console.error("[cancelBookingAction] cancel_booking rpc error:", error);
    return { status: "error", message: "We couldn't cancel that booking." };
  }

  const row = (Array.isArray(data) ? data[0] : data) as
    | { group_id: string | null; guest_email: string; status: string }
    | undefined;
  if (!row) return { status: "error", message: "Booking not found." };
  if (row.status === "already_cancelled") return { status: "already_cancelled" };

  try {
    const { data: bookings } = await supabase
      .from("bookings")
      .select("guest_name,court_id,slots!inner(starts_at,ends_at)")
      .eq("cancel_token", cancelToken)
      .order("starts_at", { foreignTable: "slots" });

    const rows = (bookings ?? []) as unknown as {
      guest_name: string;
      court_id: string;
      slots: { starts_at: string; ends_at: string } | null;
    }[];

    if (rows.length > 0) {
      const { data: court } = await supabase
        .from("courts")
        .select("name")
        .eq("id", rows[0].court_id)
        .single<Pick<Court, "name">>();

      if (court) {
        await sendCancellationEmail({
          courtName: court.name,
          guestName: rows[0].guest_name,
          guestEmail: row.guest_email,
          sessions: rows
            .filter((r) => r.slots)
            .map((r) => ({ startsAt: r.slots!.starts_at, endsAt: r.slots!.ends_at })),
        });
      }
    }
  } catch (err) {
    console.error("[cancelBookingAction] email step failed:", err);
  }

  return { status: "cancelled" };
}
