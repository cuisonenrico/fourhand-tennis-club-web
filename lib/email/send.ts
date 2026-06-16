import "server-only";

import { queueEmail } from "@/lib/email/mailer";
import { buildBookingIcs } from "@/lib/ics";
import { formatDateLong, formatTimeRange, formatPrice } from "@/lib/utils";
import BookingConfirmation from "@/emails/booking-confirmation";
import StaffNewBooking from "@/emails/staff-new-booking";
import Cancellation from "@/emails/cancellation";
import ContactAck from "@/emails/contact-ack";

interface BookingEmailContext {
  courtName: string;
  startsAt: string;
  endsAt: string;
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  priceCents: number;
  cancelToken: string;
}

function siteUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  return `${base}${path}`;
}

const MAP_URL = "https://maps.google.com/?q=Fourhand+Tennis+Club";

/** Player confirmation (with .ics) + staff notification. Never throws. */
export async function sendBookingEmails(ctx: BookingEmailContext): Promise<void> {
  const dateLabel = formatDateLong(ctx.startsAt);
  const timeLabel = formatTimeRange(ctx.startsAt, ctx.endsAt);
  const priceLabel = formatPrice(ctx.priceCents);
  const cancelUrl = siteUrl(`/cancel/${ctx.cancelToken}`);

  const ics = buildBookingIcs({
    courtName: ctx.courtName,
    startsAt: ctx.startsAt,
    endsAt: ctx.endsAt,
    guestName: ctx.guestName,
  });

  await queueEmail({
    type: "booking_confirmation",
    to: ctx.guestEmail,
    subject: `Your court is booked — ${ctx.courtName}`,
    react: BookingConfirmation({
      guestName: ctx.guestName,
      courtName: ctx.courtName,
      dateLabel,
      timeLabel,
      priceLabel,
      cancelUrl,
      mapUrl: MAP_URL,
    }),
    attachments: [{ filename: "fourhand-booking.ics", content: ics }],
    payload: { cancelToken: ctx.cancelToken, startsAt: ctx.startsAt },
  });

  const staffEmail = process.env.STAFF_EMAIL;
  if (staffEmail) {
    await queueEmail({
      type: "staff_new_booking",
      to: staffEmail,
      subject: `New booking — ${ctx.courtName}, ${dateLabel}`,
      react: StaffNewBooking({
        courtName: ctx.courtName,
        dateLabel,
        timeLabel,
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
  startsAt: string;
  endsAt: string;
  guestName: string;
  guestEmail: string;
}): Promise<void> {
  await queueEmail({
    type: "cancellation",
    to: ctx.guestEmail,
    subject: `Booking cancelled — ${ctx.courtName}`,
    react: Cancellation({
      guestName: ctx.guestName,
      courtName: ctx.courtName,
      dateLabel: formatDateLong(ctx.startsAt),
      timeLabel: formatTimeRange(ctx.startsAt, ctx.endsAt),
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
