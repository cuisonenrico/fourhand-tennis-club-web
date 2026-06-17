import { Clock, Mail, MapPin, Phone } from "lucide-react";
import { SectionHeading } from "./section-heading";
import { Reveal } from "@/components/motion/reveal";
import { formatHours } from "@/lib/utils";
import { DEFAULT_PUBLIC_SETTINGS, type PublicSettings } from "@/lib/settings/public";

export function ContactSection({
  settings = DEFAULT_PUBLIC_SETTINGS,
}: {
  settings?: PublicSettings;
}) {
  return (
    <section id="contact" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
      <SectionHeading
        eyebrow="Find us"
        title="Visit the club"
        description="Drop in, call ahead, or send a note — we're easy to reach."
      />

      <div className="mt-10 grid gap-8 lg:grid-cols-2">
        <Reveal>
          <div className="overflow-hidden rounded-card shadow-soft">
            {/* Keyless Google Maps embed driven by the configured address. */}
            <iframe
              title={`Map to ${settings.clubName}`}
              src={`https://maps.google.com/maps?q=${encodeURIComponent(settings.address)}&z=14&output=embed`}
              className="h-72 w-full border-0 lg:h-full"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        </Reveal>

        <Reveal delay={0.1}>
          <ul className="grid gap-4 sm:grid-cols-2">
            <InfoCard icon={<MapPin size={20} />} title="Address">{settings.address}</InfoCard>
            <InfoCard icon={<Clock size={20} />} title="Hours">
              {formatHours(settings.openTime, settings.closeTime)}
            </InfoCard>
            <InfoCard icon={<Phone size={20} />} title="Phone">
              <a className="hover:text-green" href={`tel:${settings.phone.replace(/\s+/g, "")}`}>
                {settings.phone}
              </a>
            </InfoCard>
            <InfoCard icon={<Mail size={20} />} title="Email">
              <a className="hover:text-green" href={`mailto:${settings.email}`}>{settings.email}</a>
            </InfoCard>
          </ul>
        </Reveal>
      </div>
    </section>
  );
}

function InfoCard({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <li className="rounded-card border border-surface bg-white p-5 shadow-soft">
      <span className="grid h-10 w-10 place-items-center rounded-xl bg-green-50 text-green-600">{icon}</span>
      <h3 className="mt-3 text-sm font-semibold text-charcoal">{title}</h3>
      <p className="mt-1 text-sm text-charcoal/70">{children}</p>
    </li>
  );
}
