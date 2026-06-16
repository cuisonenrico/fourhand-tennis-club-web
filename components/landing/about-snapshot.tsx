import Image from "next/image";
import Link from "next/link";
import { Reveal } from "@/components/motion/reveal";
import { Button } from "@/components/ui/button";
import { ABOUT_IMAGE } from "@/lib/data/site";

export function AboutSnapshot() {
  return (
    <section className="bg-surface/50">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-20 sm:px-6 md:grid-cols-2">
        <Reveal>
          <div className="relative aspect-[4/3] overflow-hidden rounded-card shadow-soft">
            {/* SWAP POINT: a warm photo of the club / members. */}
            <Image
              src={ABOUT_IMAGE}
              alt="Players at Fourhand Tennis Club"
              fill
              sizes="(max-width: 768px) 100vw, 50vw"
              loading="lazy"
              className="object-cover"
            />
          </div>
        </Reveal>
        <Reveal delay={0.1}>
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-green">Our club</span>
            <h2 className="mt-2 text-3xl font-bold text-charcoal sm:text-4xl">
              A friendly home for every kind of player
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-charcoal/70">
              From first-timers to seasoned competitors, Fourhand is built around getting
              you on court with as little fuss as possible. Great surfaces, warm coaches,
              and a clubhouse that feels like yours.
            </p>
            <Button asChild variant="outline" className="mt-6">
              <Link href="/about">More about us</Link>
            </Button>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
