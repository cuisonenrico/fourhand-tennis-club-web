import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getCourtsWithAvailability, getPricingRules } from "@/lib/booking/queries";
import { todayKey, upcomingDateKeys } from "@/lib/utils";
import { CourtGrid } from "@/components/booking/court-grid";

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
  const dateKeys = upcomingDateKeys(14);
  const dateKey = params.date && dateKeys.includes(params.date) ? params.date : todayKey();
  const initialCourtId = params.court && UUID_RE.test(params.court) ? params.court : undefined;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-charcoal sm:text-4xl">Book a court</h1>
        <p className="mt-2 max-w-xl text-charcoal/70">
          Tap a court to see what&apos;s free. Pick a time, confirm — that&apos;s it.
        </p>
      </header>

      <BookingBoard dateKey={dateKey} dateKeys={dateKeys} initialCourtId={initialCourtId} />
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
    const [courts, pricingRules] = await Promise.all([
      getCourtsWithAvailability(supabase, dateKey),
      getPricingRules(supabase),
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
