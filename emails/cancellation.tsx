import * as React from "react";
import { DetailRow, EmailButton, EmailHeading, EmailShell, EmailText, SessionList } from "./components";

export interface CancellationProps {
  guestName: string;
  courtName: string;
  dateLabel: string;
  timeLabels: string[];
  bookUrl: string;
  intro?: string | null;
}

export default function Cancellation({
  guestName,
  courtName,
  dateLabel,
  timeLabels,
  bookUrl,
  intro,
}: CancellationProps) {
  return (
    <EmailShell preview={`Booking cancelled — ${courtName}, ${dateLabel}`}>
      <EmailHeading>Your booking is cancelled</EmailHeading>
      {intro ? (
        <EmailText>{intro}</EmailText>
      ) : (
        <EmailText>Hi {guestName.split(" ")[0]}, we&apos;ve cancelled the booking below. No charge applies.</EmailText>
      )}
      <DetailRow label="Court" value={courtName} />
      <DetailRow label="Date" value={dateLabel} />
      <SessionList times={timeLabels} />
      <EmailText>Fancy another game? You can grab a new slot any time.</EmailText>
      <EmailButton href={bookUrl}>Book another court</EmailButton>
    </EmailShell>
  );
}

Cancellation.PreviewProps = {
  guestName: "Ana Cruz",
  courtName: "Court 1 — Centre",
  dateLabel: "Wed, 1 Jul 2026",
  timeLabels: ["6:00 PM – 7:00 PM", "7:00 PM – 8:00 PM"],
  bookUrl: "https://fourhand.example/book",
} satisfies CancellationProps;
