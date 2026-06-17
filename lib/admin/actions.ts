"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSessionUser } from "@/lib/supabase/server";
import { recordAudit } from "@/lib/admin/audit";
import { courtSchema, closureSchema } from "@/lib/validation";
import { sendClosureNotice } from "@/lib/email/send";
import type { CloseCourtRow } from "@/lib/supabase/types";

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
