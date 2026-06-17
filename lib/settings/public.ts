import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { BusinessSettings } from "@/lib/supabase/types";

/** Club info shown across the public site, with safe display defaults. */
export interface PublicSettings {
  clubName: string;
  address: string;
  phone: string;
  email: string;
  /** "HH:MM[:SS]" opening time. */
  openTime: string;
  /** "HH:MM[:SS]" closing time. */
  closeTime: string;
}

/** Fallbacks used before settings are configured (or if the read fails). */
export const DEFAULT_PUBLIC_SETTINGS: PublicSettings = {
  clubName: "Fourhand Tennis Club",
  address: "123 Baseline Ave, Manila",
  phone: "+63 900 000 0000",
  email: "hello@fourhand.example",
  openTime: "06:00",
  closeTime: "22:00",
};

/**
 * Read the public-facing club settings via the anon server client. Deduped per
 * request with React `cache`, and tolerant of failure — any error or missing
 * row falls back to {@link DEFAULT_PUBLIC_SETTINGS} so the marketing site always
 * renders.
 */
export const getPublicSettings = cache(async (): Promise<PublicSettings> => {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("business_settings")
      .select("club_name,address,contact_phone,contact_email,default_open_time,default_close_time")
      .eq("id", true)
      .single<Partial<BusinessSettings>>();
    if (error || !data) return DEFAULT_PUBLIC_SETTINGS;
    return {
      clubName: data.club_name || DEFAULT_PUBLIC_SETTINGS.clubName,
      address: data.address || DEFAULT_PUBLIC_SETTINGS.address,
      phone: data.contact_phone || DEFAULT_PUBLIC_SETTINGS.phone,
      email: data.contact_email || DEFAULT_PUBLIC_SETTINGS.email,
      openTime: data.default_open_time || DEFAULT_PUBLIC_SETTINGS.openTime,
      closeTime: data.default_close_time || DEFAULT_PUBLIC_SETTINGS.closeTime,
    };
  } catch {
    return DEFAULT_PUBLIC_SETTINGS;
  }
});
