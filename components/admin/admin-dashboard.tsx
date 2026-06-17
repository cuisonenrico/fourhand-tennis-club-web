"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/browser";
import { getAdminDashboard, type AdminDashboardData } from "@/lib/admin/queries";
import { formatDateLong } from "@/lib/utils";
import { SummaryStrip } from "./summary-strip";
import { BookingList } from "./booking-list";
import { AdminDateControl } from "./admin-date-control";

/** Live booked-courts overview. New bookings appear without a refresh (§8). */
export function AdminDashboard({
  initialDay,
  initialDateKey,
}: {
  initialDay: AdminDashboardData;
  initialDateKey: string;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [dateKey, setDateKey] = useState(initialDateKey);
  const [day, setDay] = useState<AdminDashboardData>(initialDay);
  const [live, setLive] = useState(false);
  const dateRef = useRef(dateKey);
  dateRef.current = dateKey;

  const refresh = useCallback(
    async (dk: string) => {
      try {
        setDay(await getAdminDashboard(supabase, dk));
      } catch (err) {
        console.error("[admin] refresh failed:", err);
      }
    },
    [supabase],
  );

  useEffect(() => {
    const channel = supabase
      .channel("admin:bookings")
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings" }, () => {
        void refresh(dateRef.current);
      })
      .subscribe((status) => setLive(status === "SUBSCRIBED"));
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, refresh]);

  function changeDate(dk: string) {
    setDateKey(dk);
    void refresh(dk);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-charcoal">Booked courts</h1>
          <p className="text-sm text-charcoal/60">{formatDateLong(`${dateKey}T00:00:00+08:00`)}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-charcoal/50">
            <span className={`h-2 w-2 rounded-full ${live ? "bg-green" : "bg-surface"}`} />
            {live ? "Live" : "Offline"}
          </span>
          <AdminDateControl value={dateKey} onChange={changeDate} />
        </div>
      </div>

      <SummaryStrip data={day} />
      <BookingList bookings={day.bookings} />
    </div>
  );
}
