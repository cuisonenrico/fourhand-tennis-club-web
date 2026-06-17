import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getReport } from "@/lib/admin/queries";
import { toCsv } from "@/lib/admin/csv";
import { todayKey } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const start = searchParams.get("start") ?? todayKey();
  const end = searchParams.get("end") ?? todayKey();

  try {
    const supabase = createAdminClient();
    const { days } = await getReport(supabase, start, end);

    const rows = days.map((d) => ({
      date: d.dateKey,
      revenue_php: (d.revenueCents / 100).toFixed(2),
      booked_slots: d.booked,
      bookable_slots: d.bookable,
      occupancy_pct:
        d.bookable > 0 ? ((d.booked / d.bookable) * 100).toFixed(1) : "0.0",
    }));

    const csv = toCsv(rows, ["date", "revenue_php", "booked_slots", "bookable_slots", "occupancy_pct"]);
    const filename = `fourhand-report-${start}-to-${end}.csv`;

    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error("[admin/export] failed:", err);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
