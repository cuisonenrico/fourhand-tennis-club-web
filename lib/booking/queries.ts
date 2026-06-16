import { manilaDayRange } from "@/lib/utils";
import type { Court, PricingRule, Slot } from "@/lib/supabase/types";
import type { SupabaseClient } from "@supabase/supabase-js";

export type CourtTileState = "available" | "fully_booked";

export interface CourtAvailability extends Court {
  freeCount: number;
  totalCount: number;
  tileState: CourtTileState;
}

/** All active courts in display order. */
export async function getCourts(supabase: SupabaseClient): Promise<Court[]> {
  const { data, error } = await supabase
    .from("courts")
    .select("*")
    .eq("status", "active")
    .order("sort_order");
  if (error) throw error;
  return (data ?? []) as Court[];
}

export async function getPricingRules(supabase: SupabaseClient): Promise<PricingRule[]> {
  const { data, error } = await supabase.from("pricing_rules").select("*");
  if (error) throw error;
  return (data ?? []) as PricingRule[];
}

/** Slots for one court on one Manila day, ordered by start time. */
export async function getSlotsForCourt(
  supabase: SupabaseClient,
  courtId: string,
  dateKey: string,
): Promise<Slot[]> {
  const { startIso, endIso } = manilaDayRange(dateKey);
  const { data, error } = await supabase
    .from("slots")
    .select("*")
    .eq("court_id", courtId)
    .gte("starts_at", startIso)
    .lt("starts_at", endIso)
    .order("starts_at");
  if (error) throw error;
  return (data ?? []) as Slot[];
}

/** Courts annotated with free-slot counts for a given day → drives tile state. */
export async function getCourtsWithAvailability(
  supabase: SupabaseClient,
  dateKey: string,
): Promise<CourtAvailability[]> {
  const { startIso, endIso } = manilaDayRange(dateKey);
  const courts = await getCourts(supabase);

  const { data: slots, error } = await supabase
    .from("slots")
    .select("court_id,status")
    .gte("starts_at", startIso)
    .lt("starts_at", endIso);
  if (error) throw error;

  const counts = new Map<string, { free: number; total: number }>();
  for (const s of (slots ?? []) as Pick<Slot, "court_id" | "status">[]) {
    const c = counts.get(s.court_id) ?? { free: 0, total: 0 };
    c.total += 1;
    if (s.status === "free") c.free += 1;
    counts.set(s.court_id, c);
  }

  return courts.map((court) => {
    const c = counts.get(court.id) ?? { free: 0, total: 0 };
    return {
      ...court,
      freeCount: c.free,
      totalCount: c.total,
      tileState: c.free > 0 ? "available" : "fully_booked",
    };
  });
}
