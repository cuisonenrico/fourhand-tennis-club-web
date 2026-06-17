import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface AuditEntry {
  actorEmail: string;
  action: string;
  targetType?: string;
  targetId?: string;
  detail?: Record<string, unknown>;
}

/** Record an admin mutation. Never throws — audit failure must not break the op. */
export async function recordAudit(supabase: SupabaseClient, e: AuditEntry): Promise<void> {
  try {
    await supabase.from("admin_audit").insert({
      actor_email: e.actorEmail,
      action: e.action,
      target_type: e.targetType ?? null,
      target_id: e.targetId ?? null,
      detail: e.detail ?? null,
    });
  } catch (err) {
    console.error("[recordAudit] failed:", err);
  }
}
