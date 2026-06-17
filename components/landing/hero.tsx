import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/motion/reveal";
import { HERO_IMAGE } from "@/lib/data/site";
import { formatClockTime } from "@/lib/utils";
import { DEFAULT_PUBLIC_SETTINGS, type PublicSettings } from "@/lib/settings/public";

export function Hero({ settings = DEFAULT_PUBLIC_SETTINGS }: { settings?: PublicSettings }) {
  return (
    <section className="relative isolate overflow-hidden">
      {/* SWAP POINT: full-bleed photo of a Fourhand court in play (Plan §5.1). */}
      <Image
        src={HERO_IMAGE}
        alt="A tennis rally in progress on a Fourhand court"
        fill
        priority
        sizes="100vw"
        className="-z-10 object-cover"
      />
      <div className="-z-10 absolute inset-0 bg-gradient-to-b from-charcoal/70 via-charcoal/45 to-charcoal/75" />

      <div className="mx-auto flex min-h-[88vh] max-w-6xl flex-col justify-center px-4 py-24 sm:px-6">
        <Reveal>
          <span className="inline-flex w-fit items-center rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-white backdrop-blur">
            Manila · Open daily {formatClockTime(settings.openTime)}–{formatClockTime(settings.closeTime)}
          </span>
        </Reveal>
        <Reveal delay={0.05}>
          <h1 className="mt-5 max-w-3xl text-4xl font-bold leading-[1.05] text-white sm:text-6xl">
            Book a court in three taps.
          </h1>
        </Reveal>
        <Reveal delay={0.1}>
          <p className="mt-5 max-w-xl text-lg text-white/90">
            Pick a court, pick a time, confirm. No account needed — just a fast,
            visual way to get on court and play.
          </p>
        </Reveal>
        <Reveal delay={0.15}>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Button asChild size="lg" className="shadow-lift">
              <Link href="/book">Book a Court</Link>
            </Button>
            <Link
              href="/#events"
              className="text-sm font-semibold text-white/90 underline-offset-4 hover:text-white hover:underline"
            >
              or browse events &amp; classes →
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
