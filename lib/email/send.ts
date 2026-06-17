import "server-only";

import { queueEmail } from "@/lib/email/mailer";
import { buildBookingIcsMulti } from "@/lib/ics";
import { formatDateLong, formatTimeRange, formatPrice } from "@/lib/utils";
import BookingConfirmation from "@/emails/booking-confirmation";
import StaffNewBooking from "@/emails/staff-new-booking";
import Cancellation from "@/emails/cancellation";
import ContactAck from "@/emails/contact-ack";
import ClosureNotice from "@/emails/closure-notice";

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

  await queueEmail({
    type: "booking_confirmation",
    to: ctx.guestEmail,
    subject: `Your court is booked — ${ctx.courtName}`,
    react: BookingConfirmation({
      guestName: ctx.guestName,
      courtName: ctx.courtName,
      dateLabel: date,
      timeLabels: times,
      priceLabel,
      cancelUrl,
      mapUrl: MAP_URL,
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
  await queueEmail({
    type: "cancellation",
    to: ctx.guestEmail,
    subject: `Booking cancelled — ${ctx.courtName}`,
    react: Cancellation({
      guestName: ctx.guestName,
      courtName: ctx.courtName,
      dateLabel: dateLabel(ctx.sessions),
      timeLabels: timeLabels(ctx.sessions),
      bookUrl: siteUrl("/book"),
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
  await queueEmail({
    type: "closure_notice",
    to: ctx.guestEmail,
    subject: `Court closed — ${ctx.courtName}`,
    react: ClosureNotice({
      guestName: ctx.guestName,
      courtName: ctx.courtName,
      dateLabel: dateLabel(ctx.sessions),
      timeLabels: timeLabels(ctx.sessions),
      reason: ctx.reason,
      bookUrl: siteUrl("/book"),
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
