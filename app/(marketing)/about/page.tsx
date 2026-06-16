import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/motion/reveal";
import { ABOUT_IMAGE, HERO_IMAGE } from "@/lib/data/site";

export const metadata: Metadata = {
  title: "About",
  description: "The story, team and values behind Fourhand Tennis Club.",
};

const VALUES = [
  { title: "Effortless", body: "Three taps to a court. We obsess over removing friction so you spend time playing, not booking." },
  { title: "Welcoming", body: "Every level is at home here — from your very first rally to club championship finals." },
  { title: "Well-kept", body: "Surfaces, nets and lights maintained to a standard you can feel the moment you step on." },
];

export default function AboutPage() {
  return (
    <div>
      <section className="relative isolate overflow-hidden">
        <Image src={HERO_IMAGE} alt="Fourhand Tennis Club" fill priority sizes="100vw" className="-z-10 object-cover" />
        <div className="-z-10 absolute inset-0 bg-charcoal/65" />
        <div className="mx-auto max-w-6xl px-4 py-28 sm:px-6">
          <Reveal>
            <h1 className="max-w-2xl text-4xl font-bold text-white sm:text-5xl">A club built around your game</h1>
          </Reveal>
          <Reveal delay={0.08}>
            <p className="mt-4 max-w-xl text-lg text-white/90">
              Fourhand started with a simple idea: booking a court should be as quick and
              enjoyable as the match itself.
            </p>
          </Reveal>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-20 sm:px-6 md:grid-cols-2">
        <Reveal>
          <div className="relative aspect-[4/3] overflow-hidden rounded-card shadow-soft">
            <Image src={ABOUT_IMAGE} alt="Inside the club" fill sizes="(max-width:768px) 100vw, 50vw" loading="lazy" className="object-cover" />
          </div>
        </Reveal>
        <Reveal delay={0.1}>
          <div>
            <h2 className="text-3xl font-bold text-charcoal">Our story</h2>
            <p className="mt-4 text-lg leading-relaxed text-charcoal/70">
              We&apos;re a community club in the heart of Manila with six courts across hard,
              clay and grass. Our coaches have brought players from first serve to first
              trophy, and our clubhouse is where matches are replayed over good coffee.
            </p>
            <p className="mt-4 text-lg leading-relaxed text-charcoal/70">
              Whether you&apos;re booking a quick hit after work or joining the summer ladder,
              you&apos;ll find a court ready and a warm welcome waiting.
            </p>
          </div>
        </Reveal>
      </section>

      <section className="bg-surface/50">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <h2 className="text-3xl font-bold text-charcoal">What we value</h2>
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            {VALUES.map((v, i) => (
              <Reveal key={v.title} delay={i * 0.06}>
                <div className="h-full rounded-card bg-white p-6 shadow-soft">
                  <div className="h-1 w-10 rounded-full bg-green" />
                  <h3 className="mt-4 text-lg font-semibold text-charcoal">{v.title}</h3>
                  <p className="mt-2 text-sm text-charcoal/70">{v.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
          <div className="mt-10">
            <Button asChild size="lg">
              <Link href="/book">Book a Court</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
