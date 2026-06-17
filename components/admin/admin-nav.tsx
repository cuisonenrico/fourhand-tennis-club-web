"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/courts", label: "Courts & schedule" },
  { href: "/admin/bookings", label: "Bookings" },
  { href: "/admin/templates", label: "Email templates" },
  { href: "/admin/settings", label: "Settings" },
  { href: "/admin/reports", label: "Reports" },
];

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav className="border-b border-surface bg-white">
      <div className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 sm:px-6">
        {LINKS.map((l) => {
          const active = l.href === "/admin" ? pathname === "/admin" : pathname.startsWith(l.href);
          return (
            <Link
              key={l.href}
              href={l.href}
              className={cn(
                "whitespace-nowrap border-b-2 px-3 py-3 text-sm font-medium transition-colors",
                active
                  ? "border-green text-green"
                  : "border-transparent text-charcoal/60 hover:text-charcoal",
              )}
            >
              {l.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
