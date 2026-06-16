import * as React from "react";
import { DetailRow, EmailButton, EmailHeading, EmailShell, EmailText, SessionList } from "./components";

export interface BookingConfirmationProps {
  guestName: string;
  courtName: string;
  dateLabel: string;
  timeLabels: string[];
  priceLabel: string;
  cancelUrl: string;
  mapUrl: string;
}

export default function BookingConfirmation({
  guestName,
  courtName,
  dateLabel,
  timeLabels,
  priceLabel,
  cancelUrl,
  mapUrl,
}: BookingConfirmationProps) {
  const hours = timeLabels.length;
  return (
    <EmailShell preview={`Your court is booked — ${courtName}, ${dateLabel}`}>
      <EmailHeading>You&apos;re on the court, {guestName.split(" ")[0]} 🎾</EmailHeading>
      <EmailText>Your booking is confirmed. We&apos;ve attached a calendar invite so it&apos;s easy to remember.</EmailText>

      <DetailRow label="Court" value={courtName} />
      <DetailRow label="Date" value={dateLabel} />
      <SessionList times={timeLabels} />
      <DetailRow label="Duration" value={`${hours} hour${hours === 1 ? "" : "s"}`} />
      <DetailRow label="Total" value={`${priceLabel} (pay at the club)`} />

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
  timeLabels: ["6:00 PM – 7:00 PM", "7:00 PM – 8:00 PM"],
  priceLabel: "₱1,600",
  cancelUrl: "https://fourhand.example/cancel/abc",
  mapUrl: "https://maps.google.com",
} satisfies BookingConfirmationProps;
