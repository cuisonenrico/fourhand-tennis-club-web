import { manilaDayRange } from "@/lib/utils";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Court, Closure, SlotStatus } from "@/lib/supabase/types";

export interface ScheduleCell { startsAt: string; status: SlotStatus; guestName: string | null }
export interface ScheduleRow { court: Court; cells: ScheduleCell[] }
export interface ScheduleGridData { rows: ScheduleRow[] }

export async function getScheduleGrid(supabase: SupabaseClient, dateKey: string): Promise<ScheduleGridData> {
  const { startIso, endIso } = manilaDayRange(dateKey);
  const courts = await getCourtsAdmin(supabase);
  const { data: slots, error } = await supabase
    .from("slots")
    .select("court_id,starts_at,status, bookings!left(guest_name,status)")
    .gte("starts_at", startIso).lt("starts_at", endIso).order("starts_at");
  if (error) throw error;

  type Row = { court_id: string; starts_at: string; status: SlotStatus; bookings: { guest_name: string; status: string }[] };
  const byCourt = new Map<string, ScheduleCell[]>();
  for (const s of (slots ?? []) as unknown as Row[]) {
    const confirmed = s.bookings?.find((b) => b.status === "confirmed");
    const cell: ScheduleCell = { startsAt: s.starts_at, status: s.status, guestName: confirmed?.guest_name ?? null };
    byCourt.set(s.court_id, [...(byCourt.get(s.court_id) ?? []), cell]);
  }
  return { rows: courts.map((court) => ({ court, cells: byCourt.get(court.id) ?? [] })) };
}

export interface ActiveClosure extends Closure {
  courtName: string;
}

export async function getActiveClosures(supabase: SupabaseClient): Promise<ActiveClosure[]> {
  const { data, error } = await supabase
    .from("closures")
    .select("*, courts!inner(name)")
    .eq("status", "active")
    .order("starts_at");
  if (error) throw error;
  return ((data ?? []) as unknown as (Closure & { courts: { name: string } })[]).map((c) => ({
    ...c,
    courtName: c.courts.name,
  }));
}

/** All courts (incl. maintenance) in display order, for admin. */
export async function getCourtsAdmin(supabase: SupabaseClient): Promise<Court[]> {
  const { data, error } = await supabase.from("courts").select("*").order("sort_order");
  if (error) throw error;
  return (data ?? []) as Court[];
}

export function summariseRevenue(bookings: AdminBooking[]): number {
  return bookings
    .filter((b) => b.status === "confirmed")
    .reduce((sum, b) => sum + b.priceCents, 0);
}

export interface AdminDashboardData extends AdminDay {
  revenueCents: number;
  occupiedSlots: number;
  bookableSlots: number;
  nextBooking: AdminBooking | null;
}

export async function getAdminDashboard(
  supabase: SupabaseClient,
  dateKey: string,
): Promise<AdminDashboardData> {
  const { startIso, endIso } = manilaDayRange(dateKey);
  const day = await getAdminDay(supabase, dateKey);

  // Slot occupancy for the day, excluding closures from the denominator.
  const { data: slots } = await supabase
    .from("slots")
    .select("status")
    .gte("starts_at", startIso)
    .lt("starts_at", endIso);
  const rows = (slots ?? []) as { status: string }[];
  const bookableSlots = rows.filter((s) => s.status !== "closed").length;
  const occupiedSlots = rows.filter((s) => s.status === "booked").length;

  const nowIso = new Date().toISOString();
  const nextBooking =
    day.bookings.find((b) => b.startsAt >= nowIso) ?? null;

  return {
    ...day,
    revenueCents: summariseRevenue(day.bookings),
    occupiedSlots,
    bookableSlots,
    nextBooking,
  };
}

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
