import type { Metadata } from "next";
import { LoginForm } from "@/components/admin/login-form";

export const metadata: Metadata = {
  title: "Staff sign in",
  robots: { index: false },
};

export default function AdminLoginPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-surface/40 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center justify-center gap-2 font-bold text-charcoal">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-green text-white">F</span>
          Fourhand · Staff
        </div>
        <LoginForm />
        <p className="mt-4 text-center text-xs text-charcoal/50">
          Staff accounts are created by the club owner. There is no public sign-up.
        </p>
      </div>
    </main>
  );
}
