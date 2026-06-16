import type { Metadata } from "next";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { getCourtsWithAvailability, getPricingRules } from "@/lib/booking/queries";
import { ensureSlotsForDate } from "@/lib/booking/ensure-slots";
import { isWithinHorizon, maxDateKey, todayKey, upcomingDateKeys, QUICK_DATE_CHIPS } from "@/lib/utils";
import { CourtGrid } from "@/components/booking/court-grid";
import { BookHeader, BookingBoardSkeleton } from "@/components/booking/booking-skeleton";

export const metadata: Metadata = {
  title: "Book a court",
  description: "Pick a court, pick a time, confirm. Live availability, no account needed.",
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function BookPage({
  searchParams,
}: {
  searchParams: Promise<{ court?: string; date?: string }>;
}) {
  const params = await searchParams;
  const dateKeys = upcomingDateKeys(QUICK_DATE_CHIPS);
  const dateKey = params.date && isWithinHorizon(params.date) ? params.date : todayKey();
  const initialCourtId = params.court && UUID_RE.test(params.court) ? params.court : undefined;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <BookHeader />

      {/* The shell renders immediately; the live board streams in behind a
          skeleton so navigation never feels blocked. */}
      <Suspense key={`${dateKey}:${initialCourtId ?? ""}`} fallback={<BookingBoardSkeleton />}>
        <BookingBoard dateKey={dateKey} dateKeys={dateKeys} initialCourtId={initialCourtId} />
      </Suspense>
    </div>
  );
}

async function BookingBoard({
  dateKey,
  dateKeys,
  initialCourtId,
}: {
  dateKey: string;
  dateKeys: string[];
  initialCourtId?: string;
}) {
  try {
    const supabase = await createClient();
    // Pricing is independent of slot generation — fetch it in parallel.
    const pricingPromise = getPricingRules(supabase);
    // Ensure the requested day has slots (lazy generation for far dates) before
    // reading availability.
    await ensureSlotsForDate(dateKey);
    const [courts, pricingRules] = await Promise.all([
      getCourtsWithAvailability(supabase, dateKey),
      pricingPromise,
    ]);

    if (courts.length === 0) {
      return <EmptyState />;
    }

    return (
      <CourtGrid
        initialCourts={courts}
        pricingRules={pricingRules}
        initialDateKey={dateKey}
        dateKeys={dateKeys}
        maxDateKey={maxDateKey()}
        initialCourtId={initialCourtId}
      />
    );
  } catch (err) {
    console.error("[book] initial load failed:", err);
    return <ErrorState />;
  }
}

function EmptyState() {
  return (
    <div className="rounded-card border border-surface bg-white p-10 text-center shadow-soft">
      <p className="font-semibold text-charcoal">No courts available yet</p>
      <p className="mt-1 text-sm text-charcoal/60">
        Once courts and slots are seeded, they&apos;ll appear here.
      </p>
    </div>
  );
}

function ErrorState() {
  return (
    <div className="rounded-card border border-surface bg-white p-10 text-center shadow-soft">
      <p className="font-semibold text-charcoal">We couldn&apos;t load availability</p>
      <p className="mt-1 text-sm text-charcoal/60">
        Please refresh in a moment. If this persists, the booking service may be starting up.
      </p>
    </div>
  );
}
