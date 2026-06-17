import "server-only";

import { queueEmail } from "@/lib/email/mailer";
import { buildBookingIcsMulti } from "@/lib/ics";
import { formatDateLong, formatTimeRange, formatPrice } from "@/lib/utils";
import BookingConfirmation from "@/emails/booking-confirmation";
import StaffNewBooking from "@/emails/staff-new-booking";
import Cancellation from "@/emails/cancellation";
import ContactAck from "@/emails/contact-ack";
import ClosureNotice from "@/emails/closure-notice";
import BookingReassigned from "@/emails/booking-reassigned";
import BookingReminder from "@/emails/booking-reminder";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveTemplate } from "@/lib/email/templates";

interface Session {
  startsAt: string;
  endsAt: string;
}

interface BookingEmailContext {
  courtName: string;
  sessions: Session[];
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  totalPriceCents: number;
  cancelToken: string;
}

function siteUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  return `${base}${path}`;
}

const MAP_URL = "https://maps.google.com/?q=Fourhand+Tennis+Club";

/** Human label for the day(s) a booking spans. */
function dateLabel(sessions: Session[]): string {
  return formatDateLong(sessions[0].startsAt);
}

/** "6:00 PM – 7:00 PM, 7:00 PM – 8:00 PM" across all booked hours. */
function timeLabels(sessions: Session[]): string[] {
  return sessions.map((s) => formatTimeRange(s.startsAt, s.endsAt));
}

/** Player confirmation (with .ics) + staff notification. Never throws. */
export async function sendBookingEmails(ctx: BookingEmailContext): Promise<void> {
  const times = timeLabels(ctx.sessions);
  const date = dateLabel(ctx.sessions);
  const priceLabel = formatPrice(ctx.totalPriceCents);
  const cancelUrl = siteUrl(`/cancel/${ctx.cancelToken}`);

  const ics = buildBookingIcsMulti({
    courtName: ctx.courtName,
    guestName: ctx.guestName,
    sessions: ctx.sessions,
  });

  const tpl = await resolveTemplate(createAdminClient(), "booking_confirmation", {
    subject: `Your court is booked — ${ctx.courtName}`,
    intro: null,
  });

  await queueEmail({
    type: "booking_confirmation",
    to: ctx.guestEmail,
    subject: tpl.subject,
    react: BookingConfirmation({
      guestName: ctx.guestName,
      courtName: ctx.courtName,
      dateLabel: date,
      timeLabels: times,
      priceLabel,
      cancelUrl,
      mapUrl: MAP_URL,
      intro: tpl.intro,
    }),
    attachments: [{ filename: "fourhand-booking.ics", content: ics }],
    payload: { cancelToken: ctx.cancelToken, sessions: ctx.sessions },
  });

  const staffEmail = process.env.STAFF_EMAIL;
  if (staffEmail) {
    await queueEmail({
      type: "staff_new_booking",
      to: staffEmail,
      subject: `New booking — ${ctx.courtName}, ${date}`,
      react: StaffNewBooking({
        courtName: ctx.courtName,
        dateLabel: date,
        timeLabels: times,
        guestName: ctx.guestName,
        guestEmail: ctx.guestEmail,
        guestPhone: ctx.guestPhone,
        priceLabel,
      }),
    });
  }
}

export async function sendCancellationEmail(ctx: {
  courtName: string;
  guestName: string;
  guestEmail: string;
  sessions: Session[];
}): Promise<void> {
  const tpl = await resolveTemplate(createAdminClient(), "cancellation", {
    subject: `Booking cancelled — ${ctx.courtName}`,
    intro: null,
  });
  await queueEmail({
    type: "cancellation",
    to: ctx.guestEmail,
    subject: tpl.subject,
    react: Cancellation({
      guestName: ctx.guestName,
      courtName: ctx.courtName,
      dateLabel: dateLabel(ctx.sessions),
      timeLabels: timeLabels(ctx.sessions),
      bookUrl: siteUrl("/book"),
      intro: tpl.intro,
    }),
  });
}

export async function sendClosureNotice(ctx: {
  courtName: string;
  guestName: string;
  guestEmail: string;
  reason: string;
  sessions: Session[];
}): Promise<void> {
  const tpl = await resolveTemplate(createAdminClient(), "closure_notice", {
    subject: `Court closed — ${ctx.courtName}`,
    intro: null,
  });
  await queueEmail({
    type: "closure_notice",
    to: ctx.guestEmail,
    subject: tpl.subject,
    react: ClosureNotice({
      guestName: ctx.guestName,
      courtName: ctx.courtName,
      dateLabel: dateLabel(ctx.sessions),
      timeLabels: timeLabels(ctx.sessions),
      reason: ctx.reason,
      bookUrl: siteUrl("/book"),
      intro: tpl.intro,
    }),
  });
}

export async function sendBookingReassigned(ctx: {
  courtName: string;
  guestName: string;
  guestEmail: string;
  cancelToken: string;
  sessions: Session[];
}): Promise<void> {
  await queueEmail({
    type: "booking_reassigned",
    to: ctx.guestEmail,
    subject: `Your booking was moved — ${ctx.courtName}`,
    react: BookingReassigned({
      guestName: ctx.guestName,
      courtName: ctx.courtName,
      dateLabel: dateLabel(ctx.sessions),
      timeLabels: timeLabels(ctx.sessions),
      cancelUrl: siteUrl(`/cancel/${ctx.cancelToken}`),
    }),
  });
}

export async function sendBookingReminder(ctx: {
  courtName: string;
  guestName: string;
  guestEmail: string;
  cancelToken: string;
  sessions: Session[];
}): Promise<void> {
  const tpl = await resolveTemplate(createAdminClient(), "booking_reminder", {
    subject: `Reminder: your court is coming up — ${ctx.courtName}`,
    intro: null,
  });
  await queueEmail({
    type: "booking_reminder",
    to: ctx.guestEmail,
    subject: tpl.subject,
    react: BookingReminder({
      guestName: ctx.guestName,
      courtName: ctx.courtName,
      dateLabel: dateLabel(ctx.sessions),
      timeLabels: timeLabels(ctx.sessions),
      cancelUrl: siteUrl(`/cancel/${ctx.cancelToken}`),
      intro: tpl.intro,
    }),
  });
}

export async function sendContactEmails(ctx: {
  name: string;
  email: string;
  message: string;
}): Promise<void> {
  await queueEmail({
    type: "contact_ack",
    to: ctx.email,
    subject: "We received your message — Fourhand Tennis Club",
    react: ContactAck({ name: ctx.name, message: ctx.message }),
  });

  const staffEmail = process.env.STAFF_EMAIL;
  if (staffEmail) {
    await queueEmail({
      type: "contact_forward",
      to: staffEmail,
      subject: `Contact enquiry from ${ctx.name}`,
      react: ContactAck({ name: ctx.name, message: ctx.message }),
      payload: { from: ctx.email },
    });
  }
}
