import { manilaDayRange } from "@/lib/utils";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Court, Closure, Slot, SlotStatus, EmailTemplate, BusinessSettings } from "@/lib/supabase/types";
import { getSlotsForCourt } from "@/lib/booking/queries";

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

export interface BookingFilters {
  dateKey?: string;
  courtId?: string;
  status?: "confirmed" | "cancelled";
  q?: string; // name or email substring
}

export interface AdminBookingDetail extends AdminBooking {
  guestEmail: string;
  guestPhone: string;
  bookingGroupId: string | null;
  cancelToken: string;
  source: string;
  courtId: string;
  slotId: string;
}

export async function searchBookings(
  supabase: SupabaseClient,
  f: BookingFilters,
): Promise<AdminBookingDetail[]> {
  let query = supabase
    .from("bookings")
    .select(
      "id,guest_name,guest_email,guest_phone,status,price_cents,source,court_id,slot_id,booking_group_id,cancel_token,slots!inner(starts_at,ends_at),courts!inner(name)",
    )
    .order("starts_at", { foreignTable: "slots", ascending: false })
    .limit(200);

  if (f.status) query = query.eq("status", f.status);
  if (f.courtId) query = query.eq("court_id", f.courtId);
  if (f.dateKey) {
    const { startIso, endIso } = manilaDayRange(f.dateKey);
    query = query.gte("slots.starts_at", startIso).lt("slots.starts_at", endIso);
  }
  if (f.q) query = query.or(`guest_name.ilike.%${f.q}%,guest_email.ilike.%${f.q}%`);

  const { data, error } = await query;
  if (error) throw error;

  type Row = {
    id: string;
    guest_name: string;
    guest_email: string;
    guest_phone: string;
    status: "confirmed" | "cancelled";
    price_cents: number;
    source: string;
    court_id: string;
    slot_id: string;
    booking_group_id: string | null;
    cancel_token: string;
    slots: { starts_at: string; ends_at: string } | null;
    courts: { name: string } | null;
  };

  return ((data ?? []) as unknown as Row[])
    .filter((r) => r.slots && r.courts)
    .map((r) => ({
      id: r.id,
      guestName: r.guest_name,
      guestEmail: r.guest_email,
      guestPhone: r.guest_phone,
      status: r.status,
      priceCents: r.price_cents,
      source: r.source,
      courtId: r.court_id,
      slotId: r.slot_id,
      bookingGroupId: r.booking_group_id,
      cancelToken: r.cancel_token,
      courtName: r.courts!.name,
      startsAt: r.slots!.starts_at,
      endsAt: r.slots!.ends_at,
    }));
}

/** Free slots for one court on one Manila day (lapsed holds treated as free). */
export async function getFreeSlotsForCourtDay(
  supabase: SupabaseClient,
  courtId: string,
  dateKey: string,
): Promise<Slot[]> {
  const slots = await getSlotsForCourt(supabase, courtId, dateKey);
  return slots.filter((s) => s.status === "free");
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

/** Business settings singleton row. */
export async function getBusinessSettings(supabase: SupabaseClient): Promise<BusinessSettings> {
  const { data, error } = await supabase.from("business_settings").select("*").eq("id", true).single();
  if (error) throw error;
  return data as BusinessSettings;
}

/** All email template overrides stored in the DB. */
export async function getTemplates(supabase: SupabaseClient): Promise<EmailTemplate[]> {
  const { data, error } = await supabase
    .from("email_templates")
    .select("*")
    .order("type");
  if (error) throw error;
  return (data ?? []) as EmailTemplate[];
}
