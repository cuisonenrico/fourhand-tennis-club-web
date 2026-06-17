"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { upsertTemplateAction } from "@/lib/admin/actions";
import type { EmailTemplate } from "@/lib/supabase/types";
import { KNOWN_EMAIL_TYPES, type EmailTemplateType } from "@/lib/validation";

// ---------------------------------------------------------------------------
// Code-default copy shown when no DB override exists
// ---------------------------------------------------------------------------

const CODE_DEFAULTS: Record<EmailTemplateType, { subject: string; intro: string }> = {
  booking_confirmation: {
    subject: "Your court is booked — {courtName}",
    intro: "Your booking is confirmed. We've attached a calendar invite so it's easy to remember.",
  },
  cancellation: {
    subject: "Booking cancelled — {courtName}",
    intro: "Hi {guestName}, we've cancelled the booking below. No charge applies.",
  },
  closure_notice: {
    subject: "Court closed — {courtName}",
    intro: "Hi {guestName}, unfortunately {courtName} is closed for your booking below ({reason}). We've cancelled it with no charge — sorry for the inconvenience.",
  },
  booking_reminder: {
    subject: "Reminder: your court booking is tomorrow — {courtName}",
    intro: "Just a friendly reminder that you have a court booked at Fourhand Tennis Club.",
  },
};

const LABEL: Record<EmailTemplateType, string> = {
  booking_confirmation: "Booking confirmation",
  cancellation: "Cancellation",
  closure_notice: "Court closure notice",
  booking_reminder: "Booking reminder",
};

// ---------------------------------------------------------------------------
// Individual row
// ---------------------------------------------------------------------------

function TemplateRow({
  type,
  saved,
}: {
  type: EmailTemplateType;
  saved: EmailTemplate | undefined;
}) {
  const router = useRouter();
  const defaults = CODE_DEFAULTS[type];
  const [editing, setEditing] = useState(false);
  const [subject, setSubject] = useState(saved?.subject ?? defaults.subject);
  const [intro, setIntro] = useState(saved?.intro ?? defaults.intro);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const hasOverride = Boolean(saved);

  function handleSave() {
    setError(null);
    startTransition(async () => {
      const result = await upsertTemplateAction({ type, subject, intro: intro || null });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setEditing(false);
      router.refresh();
    });
  }

  function handleCancel() {
    setSubject(saved?.subject ?? defaults.subject);
    setIntro(saved?.intro ?? defaults.intro);
    setEditing(false);
    setError(null);
  }

  return (
    <div className="rounded-card border border-surface bg-white p-4 shadow-soft">
      {/* Header row */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="font-semibold text-charcoal">{LABEL[type]}</p>
          <p className="mt-0.5 text-xs text-charcoal/60">
            {hasOverride ? (
              <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-0.5 font-semibold text-green-600">
                overridden
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full bg-surface px-2 py-0.5 font-semibold text-charcoal/40">
                using code default
              </span>
            )}
          </p>
        </div>
        {!editing && (
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
            Edit
          </Button>
        )}
      </div>

      {/* Inline edit */}
      {editing && (
        <div className="mt-4 space-y-3 border-t border-surface pt-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-charcoal">Subject</label>
            <input
              className="w-full rounded-xl border border-surface bg-white px-3 py-2 text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-green"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder={defaults.subject}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-charcoal">
              Intro paragraph{" "}
              <span className="font-normal text-charcoal/50">(optional — leave blank to use the code default)</span>
            </label>
            <textarea
              rows={3}
              className="w-full rounded-xl border border-surface bg-white px-3 py-2 text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-green"
              value={intro}
              onChange={(e) => setIntro(e.target.value)}
              placeholder={defaults.intro}
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSave} disabled={pending}>
              {pending ? "Saving…" : "Save"}
            </Button>
            <Button variant="ghost" size="sm" onClick={handleCancel} disabled={pending}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Preview when not editing */}
      {!editing && (
        <div className="mt-2 space-y-0.5">
          <p className="text-sm text-charcoal/70">
            <span className="font-medium">Subject:</span> {saved?.subject ?? defaults.subject}
          </p>
          {(saved?.intro ?? defaults.intro) && (
            <p className="text-sm text-charcoal/70">
              <span className="font-medium">Intro:</span> {saved?.intro ?? defaults.intro}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Public export
// ---------------------------------------------------------------------------

export function TemplateEditor({ saved }: { saved: EmailTemplate[] }) {
  const savedMap = new Map(saved.map((t) => [t.type, t]));
  return (
    <div className="space-y-3">
      {KNOWN_EMAIL_TYPES.map((type) => (
        <TemplateRow key={type} type={type} saved={savedMap.get(type)} />
      ))}
    </div>
  );
}
