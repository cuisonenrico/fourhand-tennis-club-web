"use client";

import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser Supabase client — uses the public anon key only.
 * Every read it performs is gated by Row Level Security.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
