"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSessionUser } from "@/lib/supabase/server";
import { recordAudit } from "@/lib/admin/audit";
import { courtSchema } from "@/lib/validation";

type ActionResult = { ok: true } | { ok: false; error: string };

async function requireAdminEmail(): Promise<string> {
  const user = await getSessionUser();
  if (!user) throw new Error("unauthorized");
  return user.email ?? "unknown";
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
