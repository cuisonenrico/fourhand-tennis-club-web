import { Car, CircleDot, Coffee, ShowerHead, Store, Zap } from "lucide-react";
import { SectionHeading } from "./section-heading";
import { Reveal } from "@/components/motion/reveal";
import { AMENITIES } from "@/lib/data/site";

const ICONS = { Store, CircleDot, Zap, ShowerHead, Car, Coffee } as const;

export function Amenities() {
  return (
    <section className="bg-surface/50">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <SectionHeading
          eyebrow="The club"
          title="Everything you need on site"
          description="Show up with a racket — or without one. We'll sort the rest."
        />
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {AMENITIES.map((a, i) => {
            const Icon = ICONS[a.icon];
            return (
              <Reveal key={a.title} delay={i * 0.05}>
                <div className="flex h-full items-start gap-4 rounded-card bg-white p-6 shadow-soft">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-green-50 text-green-600">
                    <Icon size={20} />
                  </span>
                  <div>
                    <h3 className="font-semibold text-charcoal">{a.title}</h3>
                    <p className="mt-1 text-sm text-charcoal/70">{a.description}</p>
                  </div>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
