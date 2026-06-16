import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient, getSessionUser } from "@/lib/supabase/server";
import { getAdminDay, type AdminDay } from "@/lib/admin/queries";
import { todayKey } from "@/lib/utils";
import { AdminHeader } from "@/components/admin/admin-header";
import { AdminDashboard } from "@/components/admin/admin-dashboard";

export const metadata: Metadata = {
  title: "Booked courts",
  robots: { index: false },
};

export default async function AdminOverviewPage() {
  const user = await getSessionUser();
  if (!user) redirect("/admin/login");

  const dateKey = todayKey();
  let initialDay: AdminDay = { bookings: [], courtCount: 0 };
  try {
    const supabase = await createClient();
    initialDay = await getAdminDay(supabase, dateKey);
  } catch (err) {
    console.error("[admin] initial load failed:", err);
  }

  return (
    <>
      <AdminHeader email={user.email ?? undefined} />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <AdminDashboard initialDay={initialDay} initialDateKey={dateKey} />
      </main>
    </>
  );
}
