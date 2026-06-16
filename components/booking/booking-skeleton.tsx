/** Skeleton matching the booking board layout (date chips + court grid). */
export function BookingBoardSkeleton() {
  return (
    <div aria-hidden>
      <div className="mb-6 flex gap-2 overflow-hidden">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="skeleton h-14 w-16 shrink-0 rounded-xl" />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="skeleton h-28 rounded-card" />
        ))}
      </div>
    </div>
  );
}

/** Shared page header so the shell looks identical while the board loads. */
export function BookHeader() {
  return (
    <header className="mb-8">
      <h1 className="text-3xl font-bold text-charcoal sm:text-4xl">Book a court</h1>
      <p className="mt-2 max-w-xl text-charcoal/70">
        Tap a court to see what&apos;s free. Pick one or more times, confirm — that&apos;s it.
      </p>
    </header>
  );
}
