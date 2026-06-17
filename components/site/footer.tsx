import Link from "next/link";
import { Button } from "@/components/ui/button";
import { formatHours } from "@/lib/utils";
import { DEFAULT_PUBLIC_SETTINGS, type PublicSettings } from "@/lib/settings/public";

export function Footer({ settings = DEFAULT_PUBLIC_SETTINGS }: { settings?: PublicSettings }) {
  return (
    <footer className="mt-24 border-t border-surface bg-white">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-4">
        <div className="md:col-span-2">
          <div className="flex items-center gap-2 font-bold text-charcoal">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-green text-white">
              {settings.clubName.charAt(0).toUpperCase()}
            </span>
            {settings.clubName}
          </div>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-charcoal/70">
            Pick a court, pick a time, confirm. A faster, friendlier way to play.
          </p>
          <Button asChild className="mt-6">
            <Link href="/book">Book a Court</Link>
          </Button>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-charcoal">Explore</h3>
          <ul className="mt-3 space-y-2 text-sm text-charcoal/70">
            <li><Link className="hover:text-green" href="/book">Book a court</Link></li>
            <li><Link className="hover:text-green" href="/#events">Events &amp; classes</Link></li>
            <li><Link className="hover:text-green" href="/about">About us</Link></li>
            <li><Link className="hover:text-green" href="/contact">Contact</Link></li>
          </ul>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-charcoal">Visit</h3>
          <ul className="mt-3 space-y-2 text-sm text-charcoal/70">
            <li>{settings.address}</li>
            <li>{formatHours(settings.openTime, settings.closeTime)}</li>
            <li><a className="hover:text-green" href={`tel:${settings.phone.replace(/\s+/g, "")}`}>{settings.phone}</a></li>
            <li><a className="hover:text-green" href={`mailto:${settings.email}`}>{settings.email}</a></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-surface">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-5 text-xs text-charcoal/60 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <span>© {new Date().getFullYear()} {settings.clubName}. All rights reserved.</span>
          <span className="flex gap-4">
            <Link className="hover:text-green" href="/contact">Privacy</Link>
            <Link className="hover:text-green" href="/contact">Terms</Link>
            <Link className="hover:text-green" href="/admin">Staff</Link>
          </span>
        </div>
      </div>
    </footer>
  );
}
