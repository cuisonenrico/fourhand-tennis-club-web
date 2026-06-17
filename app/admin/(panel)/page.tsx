import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getAdminDay, type AdminDay } from "@/lib/admin/queries";
import { todayKey } from "@/lib/utils";
import { AdminDashboard } from "@/components/admin/admin-dashboard";

export const metadata: Metadata = {
  title: "Dashboard",
  robots: { index: false },
};

export default async function AdminOverviewPage() {
  const dateKey = todayKey();
  let initialDay: AdminDay = { bookings: [], courtCount: 0 };
  try {
    const supabase = await createClient();
    initialDay = await getAdminDay(supabase, dateKey);
  } catch (err) {
    console.error("[admin] initial load failed:", err);
  }

  return <AdminDashboard initialDay={initialDay} initialDateKey={dateKey} />;
}
