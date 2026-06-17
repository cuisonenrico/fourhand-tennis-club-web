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

export type ConfirmBookingInput = z.infer<typeof confirmBookingSchema>;
export type ContactInput = z.infer<typeof contactSchema>;
export type GuestInput = z.infer<typeof guestSchema>;
