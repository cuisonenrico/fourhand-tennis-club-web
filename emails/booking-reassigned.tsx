import * as React from "react";
import { DetailRow, EmailButton, EmailHeading, EmailShell, EmailText, SessionList } from "./components";

export interface BookingReassignedProps {
  guestName: string;
  courtName: string;
  dateLabel: string;
  timeLabels: string[];
  cancelUrl: string;
}

export default function BookingReassigned({
  guestName,
  courtName,
  dateLabel,
  timeLabels,
  cancelUrl,
}: BookingReassignedProps) {
  return (
    <EmailShell preview={`Booking updated — ${courtName}, ${dateLabel}`}>
      <EmailHeading>Your booking was moved</EmailHeading>
      <EmailText>
        Hi {guestName.split(" ")[0]}, we&apos;ve moved your booking. Here are the new details —
        no charge applies.
      </EmailText>
      <DetailRow label="Court" value={courtName} />
      <DetailRow label="Date" value={dateLabel} />
      <SessionList times={timeLabels} />
      <EmailButton href={cancelUrl}>View or cancel</EmailButton>
    </EmailShell>
  );
}

BookingReassigned.PreviewProps = {
  guestName: "Ana Cruz",
  courtName: "Court 2",
  dateLabel: "Wed, 1 Jul 2026",
  timeLabels: ["7:00 PM – 8:00 PM"],
  cancelUrl: "https://fourhand.example/cancel/x",
} satisfies BookingReassignedProps;
