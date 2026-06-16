"use server";

import { contactSchema } from "@/lib/validation";
import { sendContactEmails } from "@/lib/email/send";

export type ContactState = { ok: boolean; message: string } | null;

/** Handle the contact form: validate, acknowledge sender, forward to staff. */
export async function submitContact(
  _prev: ContactState,
  formData: FormData,
): Promise<ContactState> {
  const parsed = contactSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    message: formData.get("message"),
  });

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Please check the form." };
  }

  try {
    await sendContactEmails(parsed.data);
  } catch (err) {
    console.error("[submitContact] failed:", err);
    return { ok: false, message: "Something went wrong sending your message. Please try again." };
  }

  return { ok: true, message: "Thanks! We've got your message and will reply soon." };
}
