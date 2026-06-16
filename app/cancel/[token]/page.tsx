import type { Metadata } from "next";
import { SiteShell } from "@/components/site/site-shell";
import { CancelView } from "@/components/booking/cancel-view";

export const metadata: Metadata = {
  title: "Cancel booking",
  robots: { index: false },
};

export default async function CancelPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <SiteShell>
      <div className="mx-auto max-w-md px-4 py-20 sm:px-6">
        <CancelView token={token} />
      </div>
    </SiteShell>
  );
}
