import { BookHeader, BookingBoardSkeleton } from "@/components/booking/booking-skeleton";

/** Shown instantly on navigation to /book while the dynamic page resolves. */
export default function BookLoading() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <BookHeader />
      <BookingBoardSkeleton />
    </div>
  );
}
