import { Reveal } from "@/components/motion/reveal";

export function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description?: string;
}) {
  return (
    <Reveal>
      <div className="max-w-2xl">
        <span className="text-xs font-semibold uppercase tracking-wider text-green">{eyebrow}</span>
        <h2 className="mt-2 text-3xl font-bold text-charcoal sm:text-4xl">{title}</h2>
        {description && <p className="mt-3 text-lg text-charcoal/70">{description}</p>}
      </div>
    </Reveal>
  );
}
