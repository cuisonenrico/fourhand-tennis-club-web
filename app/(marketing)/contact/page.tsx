import type { Metadata } from "next";
import { ContactSection } from "@/components/landing/contact-section";
import { ContactForm } from "@/components/contact/contact-form";

export const metadata: Metadata = {
  title: "Contact",
  description: "Visit, call, or message Fourhand Tennis Club in Manila.",
};

export default function ContactPage() {
  return (
    <div className="pt-8">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <h1 className="text-4xl font-bold text-charcoal">Get in touch</h1>
        <p className="mt-3 max-w-xl text-lg text-charcoal/70">
          Questions about courts, coaching or events? We&apos;d love to hear from you.
        </p>
      </div>

      <ContactSection />

      <div className="mx-auto max-w-6xl px-4 pb-8 sm:px-6">
        <div className="mx-auto max-w-xl">
          <ContactForm />
        </div>
      </div>
    </div>
  );
}
