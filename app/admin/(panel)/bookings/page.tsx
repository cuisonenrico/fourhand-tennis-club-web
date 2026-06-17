import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCourtsAdmin, searchBookings } from "@/lib/admin/queries";
import { todayKey } from "@/lib/utils";
import { BookingsManager } from "@/components/admin/bookings-manager";

export const metadata: Metadata = {
  title: "Bookings",
  robots: { index: false },
};

export default async function BookingsPage() {
  const supabase = createAdminClient();
  const dateKey = todayKey();

  const [courts, initialBookings] = await Promise.all([
    getCourtsAdmin(supabase),
    searchBookings(supabase, { dateKey }).catch((err) => {
      console.error("[admin/bookings] initial load failed:", err);
      return [];
    }),
  ]);

  return (
    <BookingsManager
      courts={courts}
      initialBookings={initialBookings}
      initialDateKey={dateKey}
    />
  );
}
