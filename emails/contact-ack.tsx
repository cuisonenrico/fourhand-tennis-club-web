import * as React from "react";
import { EmailHeading, EmailShell, EmailText } from "./components";

export interface ContactAckProps {
  name: string;
  message: string;
}

export default function ContactAck({ name, message }: ContactAckProps) {
  return (
    <EmailShell preview="We received your message — Fourhand Tennis Club">
      <EmailHeading>Thanks for getting in touch, {name.split(" ")[0]}</EmailHeading>
      <EmailText>
        We&apos;ve received your message and someone from the club will reply shortly. For
        reference, here&apos;s what you sent:
      </EmailText>
      <EmailText>
        <em style={{ color: "#8a8a8f" }}>&ldquo;{message}&rdquo;</em>
      </EmailText>
    </EmailShell>
  );
}

ContactAck.PreviewProps = {
  name: "Ana Cruz",
  message: "Do you offer junior coaching on weekends?",
} satisfies ContactAckProps;
