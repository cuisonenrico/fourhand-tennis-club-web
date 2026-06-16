import * as React from "react";
import { DetailRow, EmailHeading, EmailShell, EmailText, SessionList } from "./components";

export interface StaffNewBookingProps {
  courtName: string;
  dateLabel: string;
  timeLabels: string[];
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  priceLabel: string;
}

export default function StaffNewBooking({
  courtName,
  dateLabel,
  timeLabels,
  guestName,
  guestEmail,
  guestPhone,
  priceLabel,
}: StaffNewBookingProps) {
  const hours = timeLabels.length;
  return (
    <EmailShell preview={`New booking — ${courtName}, ${dateLabel}`}>
      <EmailHeading>New court booking</EmailHeading>
      <EmailText>A booking just came in through the website.</EmailText>
      <DetailRow label="Court" value={courtName} />
      <DetailRow label="Date" value={dateLabel} />
      <SessionList times={timeLabels} />
      <DetailRow label="Duration" value={`${hours} hour${hours === 1 ? "" : "s"}`} />
      <DetailRow label="Player" value={guestName} />
      <DetailRow label="Email" value={guestEmail} />
      <DetailRow label="Phone" value={guestPhone} />
      <DetailRow label="Total" value={priceLabel} />
    </EmailShell>
  );
}

StaffNewBooking.PreviewProps = {
  courtName: "Court 1 — Centre",
  dateLabel: "Wed, 1 Jul 2026",
  timeLabels: ["6:00 PM – 7:00 PM", "7:00 PM – 8:00 PM"],
  guestName: "Ana Cruz",
  guestEmail: "ana@example.com",
  guestPhone: "0917 000 0000",
  priceLabel: "₱1,600",
} satisfies StaffNewBookingProps;
