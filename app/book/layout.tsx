import { SiteShell } from "@/components/site/site-shell";

export default function BookLayout({ children }: { children: React.ReactNode }) {
  return <SiteShell>{children}</SiteShell>;
}
