import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAdminDashboard, type AdminDashboardData } from "@/lib/admin/queries";
import { todayKey } from "@/lib/utils";
import { AdminDashboard } from "@/components/admin/admin-dashboard";

export const metadata: Metadata = {
  title: "Dashboard",
  robots: { index: false },
};

export default async function AdminOverviewPage() {
  const dateKey = todayKey();
  let initialDay: AdminDashboardData = {
    bookings: [],
    courtCount: 0,
    revenueCents: 0,
    occupiedSlots: 0,
    bookableSlots: 0,
    nextBooking: null,
  };
  try {
    initialDay = await getAdminDashboard(createAdminClient(), dateKey);
  } catch (err) {
    console.error("[admin] initial load failed:", err);
  }

  return <AdminDashboard initialDay={initialDay} initialDateKey={dateKey} />;
}
