import { describe, it, expect } from "vitest";
import { resolvePriceCents, isPeak } from "@/lib/pricing";
import type { PricingRule } from "@/lib/supabase/types";

const rules: PricingRule[] = [
  { id: "1", scope: "off-peak", peak_start: null, peak_end: null, is_member: false, rate_cents: 50000 },
  { id: "2", scope: "peak", peak_start: "17:00:00", peak_end: "22:00:00", is_member: false, rate_cents: 80000 },
];

// 02:00 UTC == 10:00 Manila (UTC+8) → off-peak.
const morningUtc = "2026-07-01T02:00:00Z";
// 10:00 UTC == 18:00 Manila → peak.
const eveningUtc = "2026-07-01T10:00:00Z";
// 09:00 UTC == 17:00 Manila → start of peak (inclusive).
const peakStartUtc = "2026-07-01T09:00:00Z";

describe("resolvePriceCents", () => {
  it("charges off-peak rate before 5pm Manila", () => {
    expect(resolvePriceCents(morningUtc, rules)).toBe(50000);
  });

  it("charges peak rate during the 5pm–10pm window", () => {
    expect(resolvePriceCents(eveningUtc, rules)).toBe(80000);
  });

  it("treats peak_start as inclusive", () => {
    expect(resolvePriceCents(peakStartUtc, rules)).toBe(80000);
  });

  it("falls back to 0 when no rule matches", () => {
    expect(resolvePriceCents(morningUtc, [])).toBe(0);
  });
});

describe("isPeak", () => {
  it("is true in the peak window and false outside it", () => {
    expect(isPeak(eveningUtc, rules)).toBe(true);
    expect(isPeak(morningUtc, rules)).toBe(false);
  });
});
