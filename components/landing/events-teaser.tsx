import Link from "next/link";
import { SectionHeading } from "./section-heading";
import { Reveal } from "@/components/motion/reveal";
import { Button } from "@/components/ui/button";
import { TEASER_EVENTS } from "@/lib/data/site";

const TYPE_STYLES: Record<string, string> = {
  Competition: "bg-pink/15 text-pink",
  Class: "bg-purple/15 text-purple",
  Workshop: "bg-green-50 text-green-600",
};

export function EventsTeaser() {
  return (
    <section id="events" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <SectionHeading
          eyebrow="Beyond court hire"
          title="Competitions, classes & workshops"
          description="Play more, improve faster, meet people. Sign up alongside your court bookings."
        />
        <Reveal>
          <Button asChild variant="outline">
            <Link href="/book">Browse all events</Link>
          </Button>
        </Reveal>
      </div>

      <div className="mt-10 grid gap-6 md:grid-cols-3">
        {TEASER_EVENTS.map((e, i) => (
          <Reveal key={e.title} delay={i * 0.06}>
            <article className="flex h-full flex-col rounded-card border border-surface bg-white p-6 shadow-soft">
              <div className="flex items-center justify-between">
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${TYPE_STYLES[e.type]}`}>
                  {e.type}
                </span>
                <span className="text-xs font-medium text-charcoal/60">{e.spots}</span>
              </div>
              <h3 className="mt-4 text-lg font-semibold text-charcoal">{e.title}</h3>
              <p className="mt-2 flex-1 text-sm text-charcoal/70">{e.blurb}</p>
              <p className="mt-4 text-sm font-medium text-green-600">{e.when}</p>
            </article>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
