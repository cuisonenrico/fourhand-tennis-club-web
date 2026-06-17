import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCourtsAdmin } from "@/lib/admin/queries";
import { CourtEditor } from "@/components/admin/court-editor";

export const metadata: Metadata = { title: "Courts & schedule", robots: { index: false } };

export default async function CourtsPage() {
  const courts = await getCourtsAdmin(createAdminClient());
  return (
    <div className="space-y-10">
      <section>
        <h1 className="mb-4 text-2xl font-bold text-charcoal">Courts</h1>
        <CourtEditor courts={courts} />
      </section>
    </div>
  );
}
