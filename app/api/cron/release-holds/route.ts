import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * Release abandoned slot holds (Tech doc §13). Scheduled via Vercel Cron
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
    const { data, error } = await supabase.rpc("release_expired_holds");
    if (error) throw error;
    return NextResponse.json({ released: data ?? 0 });
  } catch (err) {
    console.error("[cron/release-holds] failed:", err);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
