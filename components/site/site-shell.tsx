import type { ReactNode } from "react";
import { Nav } from "@/components/site/nav";
import { Footer } from "@/components/site/footer";
import { StickyCta } from "@/components/site/sticky-cta";

/** Shared public chrome: nav + content + footer, with an optional sticky CTA. */
export function SiteShell({
  children,
  stickyCta = false,
}: {
  children: ReactNode;
  stickyCta?: boolean;
}) {
  return (
    <>
      <Nav />
      <main>{children}</main>
      <Footer />
      {stickyCta && <StickyCta />}
    </>
  );
}
