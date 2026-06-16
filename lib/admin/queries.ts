import { manilaDayRange } from "@/lib/utils";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface AdminBooking {
  id: string;
  guestName: string;
  status: "confirmed" | "cancelled";
  priceCents: number;
  courtName: string;
  startsAt: string;
  endsAt: string;
}

export interface AdminDay {
  bookings: AdminBooking[];
  courtCount: number;
}

interface BookingRow {
  id: string;
  guest_name: string;
  status: "confirmed" | "cancelled";
  price_cents: number;
  slots: { starts_at: string; ends_at: string } | null;
  courts: { name: string } | null;
}

/**
 * Confirmed bookings for a Manila day, with court + time, plus the active court
 * count (for the occupied-vs-free summary). RLS limits this to signed-in staff.
 */
export async function getAdminDay(supabase: SupabaseClient, dateKey: string): Promise<AdminDay> {
  const { startIso, endIso } = manilaDayRange(dateKey);

  const [{ data: bookingRows, error }, { count }] = await Promise.all([
    supabase
      .from("bookings")
      .select("id,guest_name,status,price_cents,slots!inner(starts_at,ends_at),courts!inner(name)")
      .eq("status", "confirmed")
      .gte("slots.starts_at", startIso)
      .lt("slots.starts_at", endIso)
      .order("starts_at", { foreignTable: "slots", ascending: true }),
    supabase.from("courts").select("id", { count: "exact", head: true }).eq("status", "active"),
  ]);

  if (error) throw error;

  const bookings: AdminBooking[] = ((bookingRows ?? []) as unknown as BookingRow[])
    .filter((r) => r.slots && r.courts)
    .map((r) => ({
      id: r.id,
      guestName: r.guest_name,
      status: r.status,
      priceCents: r.price_cents,
      courtName: r.courts!.name,
      startsAt: r.slots!.starts_at,
      endsAt: r.slots!.ends_at,
    }));

  return { bookings, courtCount: count ?? 0 };
}
