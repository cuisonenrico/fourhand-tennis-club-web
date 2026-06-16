"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { signIn, type LoginState } from "@/app/admin/login/actions";
import { Button } from "@/components/ui/button";

const inputClass =
  "w-full rounded-xl border border-surface bg-white px-4 py-3 text-sm text-charcoal outline-none transition focus:border-green focus:ring-2 focus:ring-green/30";

export function LoginForm() {
  const [state, action] = useActionState<LoginState, FormData>(signIn, null);

  return (
    <form action={action} className="rounded-card border border-surface bg-white p-6 shadow-soft">
      <h1 className="text-xl font-bold text-charcoal">Sign in</h1>
      <p className="mt-1 text-sm text-charcoal/60">Access the booked-courts overview.</p>

      <div className="mt-5 space-y-4">
        <div>
          <label htmlFor="email" className="mb-1 block text-sm font-medium text-charcoal">Email</label>
          <input id="email" name="email" type="email" autoComplete="email" required className={inputClass} />
        </div>
        <div>
          <label htmlFor="password" className="mb-1 block text-sm font-medium text-charcoal">Password</label>
          <input id="password" name="password" type="password" autoComplete="current-password" required className={inputClass} />
        </div>
      </div>

      {state?.error && (
        <p role="alert" className="mt-4 rounded-lg bg-pink/10 px-3 py-2 text-sm text-pink">{state.error}</p>
      )}

      <SubmitButton />
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="mt-5 w-full" disabled={pending}>
      {pending ? "Signing in…" : "Sign in"}
    </Button>
  );
}
