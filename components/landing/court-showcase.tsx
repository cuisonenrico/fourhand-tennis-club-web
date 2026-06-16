import Image from "next/image";
import { SectionHeading } from "./section-heading";
import { Reveal } from "@/components/motion/reveal";
import { SHOWCASE_COURTS } from "@/lib/data/site";

export function CourtShowcase() {
  return (
    <section id="courts" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
      <SectionHeading
        eyebrow="The courts"
        title="Six courts, every surface"
        description="Hard, clay and grass — indoor and out, most under lights. Take your pick."
      />

      <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {SHOWCASE_COURTS.map((court, i) => (
          <Reveal key={court.name} delay={i * 0.06}>
            <article className="group overflow-hidden rounded-card bg-white shadow-soft transition-shadow hover:shadow-lift">
              <div className="relative aspect-[4/3] overflow-hidden">
                {/* SWAP POINT: real court photo. */}
                <Image
                  src={court.image}
                  alt={`${court.name} — ${court.surface} court`}
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                  loading="lazy"
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                />
              </div>
              <div className="p-5">
                <h3 className="font-semibold text-charcoal">{court.name}</h3>
                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  <Tag>{court.surface}</Tag>
                  <Tag>{court.environment}</Tag>
                  <Tag>{court.lighting}</Tag>
                </div>
              </div>
            </article>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-green-50 px-2.5 py-1 font-medium text-green-600">{children}</span>
  );
}
