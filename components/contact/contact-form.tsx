"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { submitContact, type ContactState } from "@/app/(marketing)/contact/actions";
import { Button } from "@/components/ui/button";

const inputClass =
  "w-full rounded-xl border border-surface bg-white px-4 py-3 text-sm text-charcoal shadow-sm outline-none transition focus:border-green focus:ring-2 focus:ring-green/30";

export function ContactForm() {
  const [state, action] = useActionState<ContactState, FormData>(submitContact, null);

  return (
    <form action={action} className="rounded-card border border-surface bg-white p-6 shadow-soft">
      <h3 className="text-lg font-semibold text-charcoal">Send us a message</h3>
      <p className="mt-1 text-sm text-charcoal/70">We usually reply within a day.</p>

      <div className="mt-5 space-y-4">
        <div>
          <label htmlFor="name" className="mb-1 block text-sm font-medium text-charcoal">Name</label>
          <input id="name" name="name" required className={inputClass} placeholder="Your name" />
        </div>
        <div>
          <label htmlFor="email" className="mb-1 block text-sm font-medium text-charcoal">Email</label>
          <input id="email" name="email" type="email" required className={inputClass} placeholder="you@example.com" />
        </div>
        <div>
          <label htmlFor="message" className="mb-1 block text-sm font-medium text-charcoal">Message</label>
          <textarea id="message" name="message" required rows={4} className={inputClass} placeholder="How can we help?" />
        </div>
      </div>

      {state && (
        <p
          role="status"
          className={`mt-4 rounded-lg px-3 py-2 text-sm ${
            state.ok ? "bg-green-50 text-green-600" : "bg-pink/10 text-pink"
          }`}
        >
          {state.message}
        </p>
      )}

      <SubmitButton />
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="mt-5 w-full" disabled={pending}>
      {pending ? "Sending…" : "Send message"}
    </Button>
  );
}
