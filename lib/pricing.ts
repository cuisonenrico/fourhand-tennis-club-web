import type { PricingRule } from "@/lib/supabase/types";

/**
 * Resolve the price for a slot from the pricing rules.
 * Mirrors the SQL `resolve_price_cents` function so the UI display and the
 * stored booking price always agree. Peak is decided by the slot's local
 * (Asia/Manila) start hour.
 */
export function resolvePriceCents(
  startsAt: string | Date,
  rules: PricingRule[],
): number {
  const localMinutes = manilaMinutesOfDay(startsAt);

  const peak = rules.find(
    (r) =>
      !r.is_member &&
      r.scope === "peak" &&
      r.peak_start !== null &&
      r.peak_end !== null &&
      localMinutes >= toMinutes(r.peak_start) &&
      localMinutes < toMinutes(r.peak_end),
  );
  if (peak) return peak.rate_cents;

  const offPeak = rules.find((r) => !r.is_member && r.scope === "off-peak");
  return offPeak?.rate_cents ?? 0;
}

/** Minutes-of-day for a "HH:MM" or "HH:MM:SS" time string. */
function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

/** Minutes-of-day of a timestamp, evaluated in Asia/Manila. */
function manilaMinutesOfDay(startsAt: string | Date): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Manila",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(startsAt));
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  return hour * 60 + minute;
}

export function isPeak(startsAt: string | Date, rules: PricingRule[]): boolean {
  const peakRule = rules.find((r) => r.scope === "peak" && !r.is_member);
  if (!peakRule) return false;
  return resolvePriceCents(startsAt, rules) === peakRule.rate_cents;
}
