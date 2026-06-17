"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { updateSettingsAction } from "@/lib/admin/actions";
import type { BusinessSettings } from "@/lib/supabase/types";
import type { SettingsInput } from "@/lib/validation";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function settingsToForm(s: BusinessSettings): SettingsInput {
  return {
    club_name: s.club_name,
    logo_path: s.logo_path ?? null,
    accent_hex: s.accent_hex,
    contact_email: s.contact_email ?? null,
    contact_phone: s.contact_phone ?? null,
    // DB may store "HH:MM:SS" — trim to "HH:MM"
    default_open_time: s.default_open_time.slice(0, 5),
    default_close_time: s.default_close_time.slice(0, 5),
    cancellation_window_hours: s.cancellation_window_hours,
    reminder_offset_hours: s.reminder_offset_hours,
  };
}

// ---------------------------------------------------------------------------
// SettingsForm
// ---------------------------------------------------------------------------

export function SettingsForm({ settings }: { settings: BusinessSettings }) {
  const router = useRouter();
  const [form, setForm] = useState<SettingsInput>(() => settingsToForm(settings));
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  function set<K extends keyof SettingsInput>(key: K, value: SettingsInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  function handleSave() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await updateSettingsAction(form);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSaved(true);
      router.refresh();
    });
  }

  const inputClass =
    "w-full rounded-xl border border-surface bg-white px-3 py-2 text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-green";

  return (
    <div className="rounded-card border border-surface bg-white p-6 shadow-soft">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">

        {/* Club name */}
        <div className="sm:col-span-2">
          <label className="mb-1 block text-sm font-medium text-charcoal">Club name</label>
          <input
            className={inputClass}
            value={form.club_name}
            onChange={(e) => set("club_name", e.target.value)}
            placeholder="e.g. Fourhand Tennis Club"
          />
        </div>

        {/* Accent colour */}
        <div>
          <label className="mb-1 block text-sm font-medium text-charcoal">
            Accent colour <span className="text-charcoal/50">(#RRGGBB)</span>
          </label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              className="h-9 w-9 cursor-pointer rounded-lg border border-surface bg-white p-0.5"
              value={form.accent_hex}
              onChange={(e) => set("accent_hex", e.target.value)}
            />
            <input
              className={inputClass}
              value={form.accent_hex}
              onChange={(e) => set("accent_hex", e.target.value)}
              placeholder="#2D6A4F"
              maxLength={7}
            />
          </div>
        </div>

        {/* Logo path */}
        <div>
          <label className="mb-1 block text-sm font-medium text-charcoal">
            Logo path <span className="text-charcoal/50">(optional)</span>
          </label>
          <input
            className={inputClass}
            value={form.logo_path ?? ""}
            onChange={(e) => set("logo_path", e.target.value || null)}
            placeholder="/images/logo.png"
          />
        </div>

        {/* Contact email */}
        <div>
          <label className="mb-1 block text-sm font-medium text-charcoal">
            Contact email <span className="text-charcoal/50">(optional)</span>
          </label>
          <input
            type="email"
            className={inputClass}
            value={form.contact_email ?? ""}
            onChange={(e) => set("contact_email", e.target.value || null)}
            placeholder="info@yourclub.com"
          />
        </div>

        {/* Contact phone */}
        <div>
          <label className="mb-1 block text-sm font-medium text-charcoal">
            Contact phone <span className="text-charcoal/50">(optional)</span>
          </label>
          <input
            type="tel"
            className={inputClass}
            value={form.contact_phone ?? ""}
            onChange={(e) => set("contact_phone", e.target.value || null)}
            placeholder="+63 912 345 6789"
          />
        </div>

        {/* Default open time */}
        <div>
          <label className="mb-1 block text-sm font-medium text-charcoal">Default open time</label>
          <input
            type="time"
            className={inputClass}
            value={form.default_open_time}
            onChange={(e) => set("default_open_time", e.target.value)}
          />
        </div>

        {/* Default close time */}
        <div>
          <label className="mb-1 block text-sm font-medium text-charcoal">Default close time</label>
          <input
            type="time"
            className={inputClass}
            value={form.default_close_time}
            onChange={(e) => set("default_close_time", e.target.value)}
          />
        </div>

        {/* Cancellation window */}
        <div>
          <label className="mb-1 block text-sm font-medium text-charcoal">
            Cancellation window <span className="text-charcoal/50">(hours, 0–168)</span>
          </label>
          <input
            type="number"
            min={0}
            max={168}
            className={inputClass}
            value={form.cancellation_window_hours}
            onChange={(e) => set("cancellation_window_hours", parseInt(e.target.value, 10) || 0)}
          />
        </div>

        {/* Reminder offset */}
        <div>
          <label className="mb-1 block text-sm font-medium text-charcoal">
            Reminder offset <span className="text-charcoal/50">(hours before, 1–168)</span>
          </label>
          <input
            type="number"
            min={1}
            max={168}
            className={inputClass}
            value={form.reminder_offset_hours}
            onChange={(e) => set("reminder_offset_hours", parseInt(e.target.value, 10) || 1)}
          />
        </div>
      </div>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      {saved && <p className="mt-4 text-sm text-green-600">Settings saved.</p>}

      <div className="mt-5">
        <Button onClick={handleSave} disabled={pending}>
          {pending ? "Saving…" : "Save settings"}
        </Button>
      </div>
    </div>
  );
}
