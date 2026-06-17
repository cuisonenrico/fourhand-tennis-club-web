import * as React from "react";
import { DetailRow, EmailButton, EmailHeading, EmailShell, EmailText, SessionList } from "./components";

export interface ClosureNoticeProps {
  guestName: string;
  courtName: string;
  dateLabel: string;
  timeLabels: string[];
  reason: string;
  bookUrl: string;
}

export default function ClosureNotice({
  guestName,
  courtName,
  dateLabel,
  timeLabels,
  reason,
  bookUrl,
}: ClosureNoticeProps) {
  return (
    <EmailShell preview={`Court closed — ${courtName}, ${dateLabel}`}>
      <EmailHeading>We had to close your court</EmailHeading>
      <EmailText>
        Hi {guestName.split(" ")[0]}, unfortunately {courtName} is closed for your booking below
        ({reason}). We&apos;ve cancelled it with no charge — sorry for the inconvenience.
      </EmailText>
      <DetailRow label="Court" value={courtName} />
      <DetailRow label="Date" value={dateLabel} />
      <SessionList times={timeLabels} />
      <EmailText>Please grab another time that suits you:</EmailText>
      <EmailButton href={bookUrl}>Rebook a court</EmailButton>
    </EmailShell>
  );
}

ClosureNotice.PreviewProps = {
  guestName: "Ana Cruz",
  courtName: "Court 1 — Centre",
  dateLabel: "Wed, 1 Jul 2026",
  timeLabels: ["6:00 PM – 7:00 PM"],
  reason: "heavy rain",
  bookUrl: "https://fourhand.example/book",
} satisfies ClosureNoticeProps;
