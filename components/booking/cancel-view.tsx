"use client";

import { useState } from "react";
import Link from "next/link";
import { cancelBookingAction } from "@/lib/booking/actions";
import { Button } from "@/components/ui/button";

type View = "idle" | "working" | "done" | "already" | "error";

export function CancelView({ token }: { token: string }) {
  const [view, setView] = useState<View>("idle");
  const [message, setMessage] = useState("");

  async function cancel() {
    setView("working");
    const result = await cancelBookingAction(token);
    if (result.status === "cancelled") setView("done");
    else if (result.status === "already_cancelled") setView("already");
    else if (result.status === "error") {
      setMessage(result.message);
      setView("error");
    }
  }

  if (view === "done" || view === "already") {
    return (
      <Result
        title={view === "done" ? "Booking cancelled" : "Already cancelled"}
        body={
          view === "done"
            ? "Your court has been released and a confirmation email is on its way. No charge applies."
            : "This booking was already cancelled. Nothing more to do."
        }
      />
    );
  }

  if (view === "error") {
    return <Result title="We couldn't cancel that" body={message || "The link may be invalid or expired."} />;
  }

  return (
    <Result
      title="Cancel this booking?"
      body="This frees the court for other players. You can always book again afterwards."
    >
      <Button onClick={cancel} disabled={view === "working"} className="w-full">
        {view === "working" ? "Cancelling…" : "Yes, cancel my booking"}
      </Button>
    </Result>
  );
}

function Result({ title, body, children }: { title: string; body: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-card border border-surface bg-white p-8 text-center shadow-soft">
      <h1 className="text-2xl font-bold text-charcoal">{title}</h1>
      <p className="mt-2 text-sm text-charcoal/70">{body}</p>
      <div className="mt-6 space-y-3">
        {children}
        <Button asChild variant="outline" className="w-full">
          <Link href="/book">Back to booking</Link>
        </Button>
      </div>
    </div>
  );
}
