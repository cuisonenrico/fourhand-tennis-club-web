import { Hero } from "@/components/landing/hero";
import { CourtShowcase } from "@/components/landing/court-showcase";
import { Amenities } from "@/components/landing/amenities";
import { EventsTeaser } from "@/components/landing/events-teaser";
import { AboutSnapshot } from "@/components/landing/about-snapshot";
import { ContactSection } from "@/components/landing/contact-section";

export default function LandingPage() {
  return (
    <>
      <Hero />
      <CourtShowcase />
      <Amenities />
      <EventsTeaser />
      <AboutSnapshot />
      <ContactSection />
    </>
  );
}
