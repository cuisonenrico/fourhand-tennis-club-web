import "server-only";

import { render } from "@react-email/render";
import type { ReactElement } from "react";
import { Resend } from "resend";
import { createAdminClient } from "@/lib/supabase/admin";

export interface QueueEmailInput {
  type: string;
  to: string;
  subject: string;
  react: ReactElement;
  /** .ics or other attachments. */
  attachments?: { filename: string; content: string }[];
  /** Structured data stored alongside the log row for auditing. */
  payload?: Record<string, unknown>;
}

/**
 * Queue a transactional email.
 *
 * Always records the send in `email_log`. If RESEND_API_KEY is configured the
 * mail is dispatched through Resend; otherwise it runs in "log only" mode — the
 * body is logged to the console and the row stays `queued`. This lets the whole
 * booking flow work end-to-end before email credentials exist (Spec §6), and a
 * slow provider never blocks the confirmation screen.
 */
export async function queueEmail(input: QueueEmailInput): Promise<void> {
  const html = await render(input.react);
  const supabase = createAdminClient();

  const { data: logRow } = await supabase
    .from("email_log")
    .insert({
      type: input.type,
      recipient: input.to,
      subject: input.subject,
      status: "queued",
      payload: input.payload ?? null,
    })
    .select("id")
    .single();

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.info(
      `[mailer] log-only mode (no RESEND_API_KEY). type=${input.type} to=${input.to} subject="${input.subject}"`,
    );
    return;
  }

  try {
    const resend = new Resend(apiKey);
    await resend.emails.send({
      from: process.env.EMAIL_FROM ?? "Fourhand Tennis Club <bookings@fourhand.example>",
      to: input.to,
      subject: input.subject,
      html,
      attachments: input.attachments?.map((a) => ({
        filename: a.filename,
        content: Buffer.from(a.content).toString("base64"),
      })),
    });
    if (logRow) {
      await supabase.from("email_log").update({ status: "sent" }).eq("id", logRow.id);
    }
  } catch (err) {
    console.error("[mailer] send failed:", err);
    if (logRow) {
      await supabase.from("email_log").update({ status: "failed" }).eq("id", logRow.id);
    }
    // Do not rethrow — email failure must never break the booking transaction.
  }
}
