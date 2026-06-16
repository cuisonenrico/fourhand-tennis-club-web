import { SiteShell } from "@/components/site/site-shell";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <SiteShell stickyCta>{children}</SiteShell>;
}
