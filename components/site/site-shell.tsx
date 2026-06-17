import type { ReactNode } from "react";
import { Nav } from "@/components/site/nav";
import { Footer } from "@/components/site/footer";
import { StickyCta } from "@/components/site/sticky-cta";
import { getPublicSettings } from "@/lib/settings/public";

/** Shared public chrome: nav + content + footer, with an optional sticky CTA. */
export async function SiteShell({
  children,
  stickyCta = false,
}: {
  children: ReactNode;
  stickyCta?: boolean;
}) {
  const settings = await getPublicSettings();
  return (
    <>
      <Nav clubName={settings.clubName} />
      <main>{children}</main>
      <Footer settings={settings} />
      {stickyCta && <StickyCta />}
    </>
  );
}
