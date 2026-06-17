import { Hero } from "@/components/landing/hero";
import { CourtShowcase } from "@/components/landing/court-showcase";
import { Amenities } from "@/components/landing/amenities";
import { FacilityMap } from "@/components/landing/facility-map";
import { EventsTeaser } from "@/components/landing/events-teaser";
import { AboutSnapshot } from "@/components/landing/about-snapshot";
import { ContactSection } from "@/components/landing/contact-section";
import { getPublicSettings } from "@/lib/settings/public";

export default async function LandingPage() {
  const settings = await getPublicSettings();
  return (
    <>
      <Hero settings={settings} />
      <CourtShowcase />
      <Amenities />
      <FacilityMap />
      <EventsTeaser />
      <AboutSnapshot />
      <ContactSection settings={settings} />
    </>
  );
}
