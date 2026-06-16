import { signOut } from "@/app/admin/login/actions";

/** Header for authenticated admin pages, with an always-available sign-out. */
export function AdminHeader({ email }: { email?: string }) {
  return (
    <header className="border-b border-surface bg-white">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-2 font-bold text-charcoal">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-green text-white">F</span>
          <span>Fourhand · Admin</span>
        </div>
        <div className="flex items-center gap-4">
          {email && <span className="hidden text-sm text-charcoal/60 sm:inline">{email}</span>}
          <form action={signOut}>
            <button className="rounded-lg border border-surface px-4 py-2 text-sm font-medium text-charcoal hover:bg-surface">
              Sign out
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
