"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSessionUser } from "@/lib/supabase/server";
import { recordAudit } from "@/lib/admin/audit";
import { courtSchema, closureSchema, adminBookingSchema, reassignSchema, templateSchema } from "@/lib/validation";
import { getTemplates } from "@/lib/admin/queries";
import { sendClosureNotice, sendBookingEmails } from "@/lib/email/send";
import { cancelBookingAction } from "@/lib/booking/actions";
import type { AdminReassignResult } from "@/lib/supabase/types";
import type { CloseCourtRow, AdminCreateResult } from "@/lib/supabase/types";
import { searchBookings, getFreeSlotsForCourtDay, type BookingFilters, type AdminBookingDetail } from "@/lib/admin/queries";
import type { Slot } from "@/lib/supabase/types";

type ActionResult = { ok: true } | { ok: false; error: string };

async function requireAdminEmail(): Promise<string> {
  const user = await getSessionUser();
  if (!user) throw new Error("unauthorized");
  return user.email ?? "unknown";
}

// ---------------------------------------------------------------------------
// Closure actions
// ---------------------------------------------------------------------------

export interface ClosureImpactRow {
  bookingGroupId: string | null;
  guestName: string;
  guestEmail: string;
  startsAt: string;
  endsAt: string;
}

function toImpact(rows: CloseCourtRow[]): ClosureImpactRow[] {
  return rows.map((r) => ({
    bookingGroupId: r.booking_group_id,
    guestName: r.guest_name,
    guestEmail: r.guest_email,
    startsAt: r.slot_starts_at,
    endsAt: r.slot_ends_at,
  }));
}

async function courtName_(
  supabase: ReturnType<typeof createAdminClient>,
  courtId: string,
): Promise<string> {
  const { data } = await supabase
    .from("courts")
    .select("name")
    .eq("id", courtId)
    .single();
  return (data as { name: string } | null)?.name ?? "Court";
}

export async function previewClosureAction(input: unknown): Promise<
  { ok: true; impact: ClosureImpactRow[] } | { ok: false; error: string }
> {
  const parsed = closureSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid closure" };
  await requireAdminEmail();
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("preview_closure_impact", {
    p_court_id: parsed.data.court_id,
    p_starts_at: parsed.data.starts_at,
    p_ends_at: parsed.data.ends_at,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, impact: toImpact((data ?? []) as CloseCourtRow[]) };
}

export async function closeCourtAction(input: unknown): Promise<ActionResult> {
  const parsed = closureSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid closure" };
  const actor = await requireAdminEmail();
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("close_court", {
    p_court_id: parsed.data.court_id,
    p_starts_at: parsed.data.starts_at,
    p_ends_at: parsed.data.ends_at,
    p_reason: parsed.data.reason,
    p_actor: actor,
  });
  if (error) return { ok: false, error: error.message };

  // Notify each affected booking group once (rows may repeat per slot).
  const impact = toImpact((data ?? []) as CloseCourtRow[]);
  const name = await courtName_(supabase, parsed.data.court_id);
  const byGroup = new Map<string, ClosureImpactRow[]>();
  for (const r of impact) {
    const key = r.bookingGroupId ?? `${r.guestEmail}-${r.startsAt}`;
    byGroup.set(key, [...(byGroup.get(key) ?? []), r]);
  }
  for (const rows of byGroup.values()) {
    try {
      await sendClosureNotice({
        courtName: name,
        guestName: rows[0].guestName,
        guestEmail: rows[0].guestEmail,
        reason: parsed.data.reason,
        sessions: rows.map((r) => ({ startsAt: r.startsAt, endsAt: r.endsAt })),
      });
    } catch (err) {
      console.error("[closeCourtAction] notify failed:", err);
    }
  }
  revalidatePath("/admin/courts");
  return { ok: true };
}

export async function reopenClosureAction(id: string): Promise<ActionResult> {
  const actor = await requireAdminEmail();
  const supabase = createAdminClient();
  const { error } = await supabase.rpc("reopen_closure", { p_id: id, p_actor: actor });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/courts");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Court actions
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Booking actions
// ---------------------------------------------------------------------------

export async function searchBookingsAction(
  filters: BookingFilters,
): Promise<AdminBookingDetail[]> {
  await requireAdminEmail();
  return searchBookings(createAdminClient(), filters);
}

export async function getFreeSlotsAction(
  courtId: string,
  dateKey: string,
): Promise<Slot[]> {
  await requireAdminEmail();
  return getFreeSlotsForCourtDay(createAdminClient(), courtId, dateKey);
}

export async function adminCreateBookingAction(input: unknown): Promise<ActionResult> {
  const parsed = adminBookingSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid booking" };
  const actor = await requireAdminEmail();
  const supabase = createAdminClient();

  const { data, error } = await supabase.rpc("admin_create_booking", {
    p_slot_ids: parsed.data.slot_ids,
    p_guest_name: parsed.data.guest_name,
    p_guest_email: parsed.data.guest_email,
    p_guest_phone: parsed.data.guest_phone,
    p_idempotency_key: `admin-${crypto.randomUUID()}`,
    p_actor: actor,
  });
  if (error) return { ok: false, error: error.message };
  const result = (Array.isArray(data) ? data[0] : data) as AdminCreateResult | undefined;
  if (!result || result.status !== "confirmed") {
    return {
      ok: false,
      error:
        result?.status === "slot_closed"
          ? "That slot is closed."
          : "That slot was just taken.",
    };
  }

  if (parsed.data.notify && result.cancel_token) {
    try {
      const { data: slotRows } = await supabase
        .from("slots")
        .select("starts_at,ends_at,court_id")
        .in("id", parsed.data.slot_ids)
        .order("starts_at");
      const rows = (slotRows ?? []) as { starts_at: string; ends_at: string; court_id: string }[];
      const { data: courtRow } = rows[0]
        ? await supabase.from("courts").select("name").eq("id", rows[0].court_id).single()
        : { data: null };
      if (rows.length && courtRow) {
        await sendBookingEmails({
          courtName: (courtRow as { name: string }).name,
          sessions: rows.map((s) => ({ startsAt: s.starts_at, endsAt: s.ends_at })),
          guestName: parsed.data.guest_name,
          guestEmail: parsed.data.guest_email,
          guestPhone: parsed.data.guest_phone,
          totalPriceCents: result.total_price_cents ?? 0,
          cancelToken: result.cancel_token,
        });
      }
    } catch (err) {
      console.error("[adminCreateBookingAction] email failed:", err);
    }
  }

  revalidatePath("/admin/bookings");
  return { ok: true };
}

export async function adminCancelAction(cancelToken: string): Promise<ActionResult> {
  const actor = await requireAdminEmail();
  const res = await cancelBookingAction(cancelToken);
  if (res.status === "error") return { ok: false, error: res.message };
  await recordAudit(createAdminClient(), {
    actorEmail: actor,
    action: "booking.cancel",
    targetType: "booking",
    targetId: cancelToken,
  });
  revalidatePath("/admin/bookings");
  return { ok: true };
}

export async function adminReassignAction(input: unknown): Promise<ActionResult> {
  const parsed = reassignSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid reassignment" };
  const actor = await requireAdminEmail();
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("admin_reassign_booking", {
    p_booking_group_id: parsed.data.booking_group_id,
    p_new_slot_ids: parsed.data.new_slot_ids,
    p_actor: actor,
  });
  if (error) return { ok: false, error: error.message };
  const result = (Array.isArray(data) ? data[0] : data) as AdminReassignResult | undefined;
  if (!result || result.status !== "reassigned") return { ok: false, error: "Target slot was just taken." };

  // Notify the player of the new details (best-effort).
  try {
    const { data: rows } = await supabase
      .from("bookings")
      .select("guest_name,guest_email,cancel_token,court_id,slots!inner(starts_at,ends_at)")
      .eq("booking_group_id", parsed.data.booking_group_id)
      .eq("status", "confirmed")
      .order("starts_at", { foreignTable: "slots" });
    const list = (rows ?? []) as unknown as {
      guest_name: string;
      guest_email: string;
      cancel_token: string;
      court_id: string;
      slots: { starts_at: string; ends_at: string } | null;
    }[];
    if (list.length) {
      const { data: court } = await supabase
        .from("courts")
        .select("name")
        .eq("id", list[0].court_id)
        .single();
      const { sendBookingReassigned } = await import("@/lib/email/send");
      await sendBookingReassigned({
        courtName: (court as { name: string } | null)?.name ?? "Court",
        guestName: list[0].guest_name,
        guestEmail: list[0].guest_email,
        cancelToken: list[0].cancel_token,
        sessions: list
          .filter((r) => r.slots)
          .map((r) => ({ startsAt: r.slots!.starts_at, endsAt: r.slots!.ends_at })),
      });
    }
  } catch (err) {
    console.error("[adminReassignAction] email failed:", err);
  }

  await recordAudit(supabase, {
    actorEmail: actor,
    action: "booking.reassign",
    targetType: "booking_group",
    targetId: parsed.data.booking_group_id,
    detail: { new_slot_ids: parsed.data.new_slot_ids },
  });
  revalidatePath("/admin/bookings");
  return { ok: true };
}

export async function upsertCourtAction(input: unknown): Promise<ActionResult> {
  const parsed = courtSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid court" };

  const actor = await requireAdminEmail();
  const supabase = createAdminClient();
  const { id, ...fields } = parsed.data;

  const { data, error } = id
    ? await supabase.from("courts").update(fields).eq("id", id).select("id").single()
    : await supabase.from("courts").insert(fields).select("id").single();
  if (error) return { ok: false, error: error.message };

  await recordAudit(supabase, {
    actorEmail: actor,
    action: id ? "court.update" : "court.create",
    targetType: "court",
    targetId: (data as { id: string }).id,
    detail: fields,
  });
  revalidatePath("/admin/courts");
  return { ok: true };
}

export async function upsertTemplateAction(input: unknown): Promise<ActionResult> {
  const parsed = templateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid template" };

  const actor = await requireAdminEmail();
  const supabase = createAdminClient();
  const { type, subject, intro } = parsed.data;

  const { error } = await supabase
    .from("email_templates")
    .upsert(
      { type, subject, intro: intro ?? null, updated_by: actor, updated_at: new Date().toISOString() },
      { onConflict: "type" },
    );
  if (error) return { ok: false, error: error.message };

  await recordAudit(supabase, {
    actorEmail: actor,
    action: "template.update",
    targetType: "email_template",
    targetId: type,
    detail: { subject, intro: intro ?? null },
  });
  revalidatePath("/admin/templates");
  return { ok: true };
}

export { getTemplates };
