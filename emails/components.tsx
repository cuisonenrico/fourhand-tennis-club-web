import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import * as React from "react";

const BRAND = {
  green: "#00B050",
  charcoal: "#3E3E42",
  surface: "#E8E8E8",
  white: "#FFFFFF",
};

export function EmailShell({
  preview,
  children,
}: {
  preview: string;
  children: React.ReactNode;
}) {
  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={{ backgroundColor: BRAND.surface, fontFamily: "Inter, Arial, sans-serif", margin: 0, padding: "24px 0" }}>
        <Container style={{ backgroundColor: BRAND.white, borderRadius: 16, maxWidth: 520, margin: "0 auto", overflow: "hidden" }}>
          <Section style={{ backgroundColor: BRAND.green, padding: "20px 32px" }}>
            <Text style={{ color: BRAND.white, fontWeight: 700, fontSize: 18, margin: 0, letterSpacing: "0.02em" }}>
              FOURHAND TENNIS CLUB
            </Text>
          </Section>
          <Section style={{ padding: "28px 32px" }}>{children}</Section>
          <Hr style={{ borderColor: BRAND.surface, margin: 0 }} />
          <Section style={{ padding: "16px 32px" }}>
            <Text style={{ color: "#8a8a8f", fontSize: 12, margin: 0 }}>
              Fourhand Tennis Club · This is a transactional message about your booking.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export function EmailHeading({ children }: { children: React.ReactNode }) {
  return (
    <Heading style={{ color: BRAND.charcoal, fontSize: 22, fontWeight: 700, margin: "0 0 12px" }}>
      {children}
    </Heading>
  );
}

export function EmailText({ children }: { children: React.ReactNode }) {
  return <Text style={{ color: BRAND.charcoal, fontSize: 15, lineHeight: "24px", margin: "0 0 12px" }}>{children}</Text>;
}

export function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <Text style={{ margin: "0 0 6px", fontSize: 15, color: BRAND.charcoal }}>
      <span style={{ color: "#8a8a8f", display: "inline-block", width: 110 }}>{label}</span>
      <strong>{value}</strong>
    </Text>
  );
}

export function EmailButton({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      style={{
        display: "inline-block",
        backgroundColor: BRAND.green,
        color: BRAND.white,
        textDecoration: "none",
        fontWeight: 600,
        fontSize: 15,
        padding: "12px 22px",
        borderRadius: 10,
        marginTop: 8,
      }}
    >
      {children}
    </a>
  );
}
