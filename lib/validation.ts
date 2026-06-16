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

export const holdSchema = z.object({
  slot_id: z.string().uuid(),
  hold_key: z.string().min(8).max(64),
});

export const confirmBookingSchema = guestSchema.extend({
  slot_id: z.string().uuid(),
  hold_key: z.string().min(8).max(64),
  idempotency_key: z.string().min(8).max(64),
});

export const contactSchema = z.object({
  name: z.string().trim().min(2, "Please enter your name").max(80),
  email: z.string().trim().email("Enter a valid email"),
  message: z.string().trim().min(10, "Tell us a little more").max(2000),
});

export type ConfirmBookingInput = z.infer<typeof confirmBookingSchema>;
export type ContactInput = z.infer<typeof contactSchema>;
export type GuestInput = z.infer<typeof guestSchema>;
