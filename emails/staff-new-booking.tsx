import * as React from "react";
import { DetailRow, EmailHeading, EmailShell, EmailText } from "./components";

export interface StaffNewBookingProps {
  courtName: string;
  dateLabel: string;
  timeLabel: string;
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  priceLabel: string;
}

export default function StaffNewBooking({
  courtName,
  dateLabel,
  timeLabel,
  guestName,
  guestEmail,
  guestPhone,
  priceLabel,
}: StaffNewBookingProps) {
  return (
    <EmailShell preview={`New booking — ${courtName}, ${dateLabel} ${timeLabel}`}>
      <EmailHeading>New court booking</EmailHeading>
      <EmailText>A booking just came in through the website.</EmailText>
      <DetailRow label="Court" value={courtName} />
      <DetailRow label="Date" value={dateLabel} />
      <DetailRow label="Time" value={timeLabel} />
      <DetailRow label="Player" value={guestName} />
      <DetailRow label="Email" value={guestEmail} />
      <DetailRow label="Phone" value={guestPhone} />
      <DetailRow label="Price" value={priceLabel} />
    </EmailShell>
  );
}

StaffNewBooking.PreviewProps = {
  courtName: "Court 1 — Centre",
  dateLabel: "Wed, 1 Jul 2026",
  timeLabel: "6:00 PM – 7:00 PM",
  guestName: "Ana Cruz",
  guestEmail: "ana@example.com",
  guestPhone: "0917 000 0000",
  priceLabel: "₱800",
} satisfies StaffNewBookingProps;
