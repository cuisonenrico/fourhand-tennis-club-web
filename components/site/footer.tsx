import Link from "next/link";
import { Button } from "@/components/ui/button";

export function Footer() {
  return (
    <footer className="mt-24 border-t border-surface bg-white">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-4">
        <div className="md:col-span-2">
          <div className="flex items-center gap-2 font-bold text-charcoal">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-green text-white">F</span>
            Fourhand Tennis Club
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
            <li>123 Baseline Ave, Manila</li>
            <li>Open daily 6:00 AM – 10:00 PM</li>
            <li><a className="hover:text-green" href="tel:+63900000000">+63 900 000 0000</a></li>
            <li><a className="hover:text-green" href="mailto:hello@fourhand.example">hello@fourhand.example</a></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-surface">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-5 text-xs text-charcoal/60 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <span>© {new Date().getFullYear()} Fourhand Tennis Club. All rights reserved.</span>
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
