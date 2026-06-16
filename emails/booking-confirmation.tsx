import * as React from "react";
import { DetailRow, EmailButton, EmailHeading, EmailShell, EmailText } from "./components";

export interface BookingConfirmationProps {
  guestName: string;
  courtName: string;
  dateLabel: string;
  timeLabel: string;
  priceLabel: string;
  cancelUrl: string;
  mapUrl: string;
}

export default function BookingConfirmation({
  guestName,
  courtName,
  dateLabel,
  timeLabel,
  priceLabel,
  cancelUrl,
  mapUrl,
}: BookingConfirmationProps) {
  return (
    <EmailShell preview={`Your court is booked — ${courtName}, ${timeLabel}`}>
      <EmailHeading>You&apos;re on the court, {guestName.split(" ")[0]} 🎾</EmailHeading>
      <EmailText>Your booking is confirmed. We&apos;ve attached a calendar invite so it&apos;s easy to remember.</EmailText>

      <DetailRow label="Court" value={courtName} />
      <DetailRow label="Date" value={dateLabel} />
      <DetailRow label="Time" value={timeLabel} />
      <DetailRow label="Duration" value="60 minutes" />
      <DetailRow label="Price" value={`${priceLabel} (pay at the club)`} />

      <EmailText>
        Bring your racket and court shoes — rackets and balls are available to hire on site.
        Find us here: <a href={mapUrl} style={{ color: "#00B050" }}>open map</a>.
      </EmailText>

      <EmailButton href={cancelUrl}>Cancel or reschedule</EmailButton>
    </EmailShell>
  );
}

BookingConfirmation.PreviewProps = {
  guestName: "Ana Cruz",
  courtName: "Court 1 — Centre",
  dateLabel: "Wed, 1 Jul 2026",
  timeLabel: "6:00 PM – 7:00 PM",
  priceLabel: "₱800",
  cancelUrl: "https://fourhand.example/cancel/abc",
  mapUrl: "https://maps.google.com",
} satisfies BookingConfirmationProps;
