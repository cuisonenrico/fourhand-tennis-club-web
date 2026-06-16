import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { isWithinHorizon } from "@/lib/utils";

/**
 * Ensure bookable slots exist for a given Manila day, generating them on demand.
 * Idempotent (the RPC uses ON CONFLICT DO NOTHING), so it's safe to call on
 * every booking-page load. Lets players book far ahead without seeding the
 * whole horizon up front. No-ops for out-of-range dates.
 */
export async function ensureSlotsForDate(dateKey: string): Promise<void> {
  if (!isWithinHorizon(dateKey)) return;
  try {
    const supabase = createAdminClient();
    await supabase.rpc("generate_slots_for_range", {
      p_start_date: dateKey,
      p_end_date: dateKey,
    });
  } catch (err) {
    console.error("[ensureSlotsForDate] generation failed:", err);
  }
}
