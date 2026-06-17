import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendBookingReminder } from "@/lib/email/send";

export const dynamic = "force-dynamic";

/**
 * Send booking reminder emails (Tech doc §12). Scheduled via Vercel Cron
 * (see vercel.json). Guarded by CRON_SECRET so it can't be triggered publicly.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const supabase = createAdminClient();
    const { data: settings } = await supabase
      .from("business_settings")
      .select("reminder_offset_hours")
      .eq("id", true)
      .single();
    const offset =
      (settings as { reminder_offset_hours: number } | null)?.reminder_offset_hours ?? 24;

    const now = Date.now();
    const windowEnd = new Date(now + offset * 3_600_000).toISOString();
    const nowIso = new Date(now).toISOString();

    const { data: rows } = await supabase
      .from("bookings")
      .select(
        "id,guest_name,guest_email,cancel_token,court_id,reminded_at,slots!inner(starts_at,ends_at),courts!inner(name)",
      )
      .eq("status", "confirmed")
      .is("reminded_at", null)
      .gte("slots.starts_at", nowIso)
      .lte("slots.starts_at", windowEnd);

    type Row = {
      id: string;
      guest_name: string;
      guest_email: string;
      cancel_token: string;
      slots: { starts_at: string; ends_at: string };
      courts: { name: string };
    };

    let sent = 0;
    for (const r of (rows ?? []) as unknown as Row[]) {
      try {
        await sendBookingReminder({
          courtName: r.courts.name,
          guestName: r.guest_name,
          guestEmail: r.guest_email,
          cancelToken: r.cancel_token,
          sessions: [{ startsAt: r.slots.starts_at, endsAt: r.slots.ends_at }],
        });
        await supabase
          .from("bookings")
          .update({ reminded_at: new Date().toISOString() })
          .eq("id", r.id);
        sent++;
      } catch (err) {
        console.error("[cron/send-reminders] one failed:", err);
      }
    }
    return NextResponse.json({ sent });
  } catch (err) {
    console.error("[cron/send-reminders] failed:", err);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
