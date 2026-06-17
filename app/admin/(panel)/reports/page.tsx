import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { getReport } from "@/lib/admin/queries";
import { todayKey, toDateKey } from "@/lib/utils";
import { ReportsView } from "@/components/admin/reports-view";

export const metadata: Metadata = {
  title: "Reports",
  robots: { index: false },
};

export default async function ReportsPage() {
  const supabase = createAdminClient();
  const endKey = todayKey();
  // Default to the last 30 days.
  const startDate = new Date(`${endKey}T00:00:00+08:00`);
  startDate.setDate(startDate.getDate() - 29);
  const startKey = toDateKey(startDate);

  const report = await getReport(supabase, startKey, endKey).catch((err) => {
    console.error("[admin/reports] initial load failed:", err);
    return { days: [], totalRevenueCents: 0 };
  });

  return (
    <ReportsView
      initialReport={report}
      initialStartKey={startKey}
      initialEndKey={endKey}
    />
  );
}
