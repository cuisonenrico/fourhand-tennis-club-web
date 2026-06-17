import * as React from "react";
import { DetailRow, EmailButton, EmailHeading, EmailShell, EmailText, SessionList } from "./components";

export interface BookingReminderProps {
  guestName: string;
  courtName: string;
  dateLabel: string;
  timeLabels: string[];
  cancelUrl: string;
  intro?: string | null;
}

export default function BookingReminder({
  guestName,
  courtName,
  dateLabel,
  timeLabels,
  cancelUrl,
  intro,
}: BookingReminderProps) {
  return (
    <EmailShell preview={`See you on court soon — ${courtName}, ${dateLabel}`}>
      <EmailHeading>See you on court soon</EmailHeading>
      {intro ? (
        <EmailText>{intro}</EmailText>
      ) : (
        <EmailText>
          Hi {guestName.split(" ")[0]}, just a reminder that your court is coming up. We look
          forward to seeing you!
        </EmailText>
      )}
      <DetailRow label="Court" value={courtName} />
      <DetailRow label="Date" value={dateLabel} />
      <SessionList times={timeLabels} />
      <EmailText>Need to make changes? You can view or cancel your booking below:</EmailText>
      <EmailButton href={cancelUrl}>View or cancel</EmailButton>
    </EmailShell>
  );
}

BookingReminder.PreviewProps = {
  guestName: "Ana Cruz",
  courtName: "Court 1 — Centre",
  dateLabel: "Wed, 1 Jul 2026",
  timeLabels: ["6:00 PM – 7:00 PM"],
  cancelUrl: "https://fourhand.example/cancel/abc123",
} satisfies BookingReminderProps;
