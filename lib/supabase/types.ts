/**
 * Hand-written database types mirroring supabase/migrations.
 * Regenerate with `supabase gen types typescript` once the project is live.
 */

export type CourtSurface = "hard" | "clay" | "grass";
export type CourtEnvironment = "indoor" | "outdoor";
export type SlotStatus = "free" | "held" | "booked" | "closed";
export type BookingStatus = "confirmed" | "cancelled";
export type BookingSource = "guest" | "admin";
export type EmailStatus = "queued" | "sent" | "failed";

export interface Court {
  id: string;
  name: string;
  surface: CourtSurface;
  environment: CourtEnvironment;
  lighting: boolean;
  open_time: string; // "06:00:00"
  close_time: string; // "22:00:00"
  status: "active" | "maintenance";
  sort_order: number;
  photo_path: string | null;
  blurb: string | null;
}

export interface Slot {
  id: string;
  court_id: string;
  starts_at: string; // timestamptz
  ends_at: string;
  status: SlotStatus;
  hold_expires_at: string | null;
  hold_key: string | null;
}

export interface Booking {
  id: string;
  court_id: string;
  slot_id: string;
  guest_name: string;
  guest_email: string;
  guest_phone: string;
  price_cents: number;
  status: BookingStatus;
  idempotency_key: string;
  cancel_token: string;
  booking_group_id: string | null;
  created_at: string;
  source: BookingSource;
  reassigned_from_slot: string | null;
  reminded_at: string | null;
}

export interface PricingRule {
  id: string;
  scope: string;
  peak_start: string | null; // "17:00:00"
  peak_end: string | null; // "22:00:00"
  is_member: boolean;
  rate_cents: number;
}

export interface EmailLog {
  id: string;
  type: string;
  recipient: string;
  subject: string;
  status: EmailStatus;
  payload: Record<string, unknown> | null;
  created_at: string;
}

export interface Closure {
  id: string;
  court_id: string;
  starts_at: string;
  ends_at: string;
  reason: string;
  status: "active" | "lifted";
  created_by: string | null;
  created_at: string;
}

export interface EmailTemplate {
  type: string;
  subject: string;
  intro: string | null;
  updated_at: string;
  updated_by: string | null;
}

export interface BusinessSettings {
  id: boolean;
  club_name: string;
  logo_path: string | null;
  accent_hex: string;
  contact_email: string | null;
  contact_phone: string | null;
  default_open_time: string;
  default_close_time: string;
  cancellation_window_hours: number;
  reminder_offset_hours: number;
  updated_at: string;
  updated_by: string | null;
}

export interface AdminAudit {
  id: string;
  actor_email: string;
  action: string;
  target_type: string | null;
  target_id: string | null;
  detail: Record<string, unknown> | null;
  created_at: string;
}

/** Shape returned by the confirm_booking RPC (single slot). */
export interface ConfirmBookingResult {
  booking_id: string;
  cancel_token: string;
  price_cents: number;
  status: "confirmed" | "slot_taken";
}

/** Shape returned by the confirm_booking_multi RPC (group of slots). */
export interface ConfirmMultiResult {
  booking_group_id: string;
  cancel_token: string;
  total_price_cents: number;
  status: "confirmed" | "slot_taken";
}

/** Shape returned by the close_court RPC. */
export interface CloseCourtRow {
  booking_group_id: string | null;
  guest_name: string;
  guest_email: string;
  cancel_token: string;
  slot_starts_at: string;
  slot_ends_at: string;
}

/** Shape returned by the admin_create RPC. */
export interface AdminCreateResult {
  booking_group_id: string | null;
  cancel_token: string | null;
  total_price_cents: number | null;
  status: "confirmed" | "slot_taken" | "slot_closed";
}

/** Shape returned by the admin_reassign RPC. */
export interface AdminReassignResult {
  status: "reassigned" | "slot_taken";
  total_price_cents: number | null;
}
