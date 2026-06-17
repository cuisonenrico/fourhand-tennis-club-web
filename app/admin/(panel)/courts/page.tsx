import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCourtsAdmin, getActiveClosures } from "@/lib/admin/queries";
import { CourtEditor } from "@/components/admin/court-editor";
import { ClosurePanel } from "@/components/admin/closure-panel";
import { ScheduleGrid } from "@/components/admin/schedule-grid";

export const metadata: Metadata = { title: "Courts & schedule", robots: { index: false } };

export default async function CourtsPage() {
  const supabase = createAdminClient();
  const [courts, closures] = await Promise.all([
    getCourtsAdmin(supabase),
    getActiveClosures(supabase),
  ]);
  return (
    <div className="space-y-10">
      <section>
        <ScheduleGrid />
      </section>
      <section>
        <h1 className="mb-4 text-2xl font-bold text-charcoal">Courts</h1>
        <CourtEditor courts={courts} />
      </section>
      <section>
        <ClosurePanel courts={courts} closures={closures} />
      </section>
    </div>
  );
}
