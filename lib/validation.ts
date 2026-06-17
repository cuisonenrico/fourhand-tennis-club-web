import { z } from "zod";

/** Guest identity — the lightweight step shared by booking and (future) events. */
export const guestSchema = z.object({
  guest_name: z.string().trim().min(2, "Please enter your name").max(80),
  guest_email: z.string().trim().email("Enter a valid email"),
  guest_phone: z
    .string()
    .trim()
    .min(7, "Enter a contact number")
    .max(20)
    .regex(/^[0-9+()\-\s]+$/, "Enter a valid phone number"),
});

/** Up to 8 hours (slots) in a single booking. */
const slotIds = z.array(z.string().uuid()).min(1, "Pick at least one time").max(8, "Up to 8 hours per booking");

export const holdSchema = z.object({
  slot_id: z.string().uuid(),
  hold_key: z.string().min(8).max(64),
});

export const holdSlotsSchema = z.object({
  slot_ids: slotIds,
  hold_key: z.string().min(8).max(64),
});

export const releaseHoldSchema = z.object({
  slot_ids: slotIds,
  hold_key: z.string().min(8).max(64),
});

export const confirmBookingSchema = guestSchema.extend({
  slot_id: z.string().uuid(),
  hold_key: z.string().min(8).max(64),
  idempotency_key: z.string().min(8).max(64),
});

export const confirmBookingMultiSchema = guestSchema.extend({
  slot_ids: slotIds,
  hold_key: z.string().min(8).max(64),
  idempotency_key: z.string().min(8).max(64),
});

export const contactSchema = z.object({
  name: z.string().trim().min(2, "Please enter your name").max(80),
  email: z.string().trim().email("Enter a valid email"),
  message: z.string().trim().min(10, "Tell us a little more").max(2000),
});

export const courtSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1, "Name required"),
  surface: z.enum(["hard", "clay", "grass"]),
  environment: z.enum(["indoor", "outdoor"]),
  lighting: z.boolean(),
  open_time: z.string().regex(/^\d{2}:\d{2}$/, "HH:MM"),
  close_time: z.string().regex(/^\d{2}:\d{2}$/, "HH:MM"),
  status: z.enum(["active", "maintenance"]),
  sort_order: z.number().int().min(0),
  blurb: z.string().optional().nullable(),
});
export type CourtInput = z.infer<typeof courtSchema>;

export const closureSchema = z.object({
  court_id: z.string().uuid(),
  starts_at: z.string().datetime({ offset: true }),
  ends_at: z.string().datetime({ offset: true }),
  reason: z.string().min(1, "Reason required"),
});

export const adminBookingSchema = z.object({
  slot_ids: z.array(z.string().uuid()).min(1, "Pick at least one slot").max(6, "Up to 6 slots per booking"),
  guest_name: z.string().min(1, "Name required"),
  guest_email: z.string().email("Enter a valid email"),
  guest_phone: z.string().min(1, "Phone required"),
  notify: z.boolean().default(true),
});
export type AdminBookingInput = z.infer<typeof adminBookingSchema>;

export const reassignSchema = z.object({
  booking_group_id: z.string().uuid(),
  new_slot_ids: z.array(z.string().uuid()).min(1).max(6),
});
export type ReassignInput = z.infer<typeof reassignSchema>;

export const KNOWN_EMAIL_TYPES = [
  "booking_confirmation",
  "cancellation",
  "closure_notice",
  "booking_reminder",
] as const;
export type EmailTemplateType = (typeof KNOWN_EMAIL_TYPES)[number];

export const templateSchema = z.object({
  type: z.enum(KNOWN_EMAIL_TYPES),
  subject: z.string().min(1, "Subject required").max(200),
  intro: z.string().max(1000).nullable().optional(),
});
export type TemplateInput = z.infer<typeof templateSchema>;

export const settingsSchema = z.object({
  club_name: z.string().min(1),
  logo_path: z.string().nullable().optional(),
  accent_hex: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  contact_email: z.string().email().nullable().optional(),
  contact_phone: z.string().nullable().optional(),
  default_open_time: z.string().regex(/^\d{2}:\d{2}$/),
  default_close_time: z.string().regex(/^\d{2}:\d{2}$/),
  cancellation_window_hours: z.number().int().min(0).max(168),
  reminder_offset_hours: z.number().int().min(1).max(168),
});
export type SettingsInput = z.infer<typeof settingsSchema>;

export type ConfirmBookingInput = z.infer<typeof confirmBookingSchema>;
export type ContactInput = z.infer<typeof contactSchema>;
export type GuestInput = z.infer<typeof guestSchema>;
