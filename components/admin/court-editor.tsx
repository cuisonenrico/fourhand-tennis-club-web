"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { upsertCourtAction, deleteCourtAction } from "@/lib/admin/actions";
import type { Court } from "@/lib/supabase/types";
import type { CourtInput } from "@/lib/validation";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const EMPTY_FORM: CourtInput = {
  name: "",
  surface: "hard",
  environment: "outdoor",
  lighting: false,
  open_time: "06:00",
  close_time: "22:00",
  status: "active",
  sort_order: 0,
  blurb: "",
};

function courtToForm(c: Court): CourtInput {
  return {
    id: c.id,
    name: c.name,
    surface: c.surface,
    environment: c.environment,
    lighting: c.lighting,
    // DB stores "HH:MM:SS" — trim to "HH:MM" for the time inputs
    open_time: c.open_time.slice(0, 5),
    close_time: c.close_time.slice(0, 5),
    status: c.status,
    sort_order: c.sort_order,
    blurb: c.blurb ?? "",
  };
}

// ---------------------------------------------------------------------------
// Shared form fields
// ---------------------------------------------------------------------------

interface CourtFormProps {
  value: CourtInput;
  onChange: (next: CourtInput) => void;
}

function CourtFormFields({ value, onChange }: CourtFormProps) {
  function set<K extends keyof CourtInput>(key: K, v: CourtInput[K]) {
    onChange({ ...value, [key]: v });
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {/* Name */}
      <div className="sm:col-span-2">
        <label className="mb-1 block text-sm font-medium text-charcoal">Name</label>
        <input
          className="w-full rounded-xl border border-surface bg-white px-3 py-2 text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-green"
          value={value.name}
          onChange={(e) => set("name", e.target.value)}
          placeholder="e.g. Court 1"
        />
      </div>

      {/* Surface */}
      <div>
        <label className="mb-1 block text-sm font-medium text-charcoal">Surface</label>
        <select
          className="w-full rounded-xl border border-surface bg-white px-3 py-2 text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-green"
          value={value.surface}
          onChange={(e) => set("surface", e.target.value as CourtInput["surface"])}
        >
          <option value="hard">Hard</option>
          <option value="clay">Clay</option>
          <option value="grass">Grass</option>
        </select>
      </div>

      {/* Environment */}
      <div>
        <label className="mb-1 block text-sm font-medium text-charcoal">Environment</label>
        <select
          className="w-full rounded-xl border border-surface bg-white px-3 py-2 text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-green"
          value={value.environment}
          onChange={(e) => set("environment", e.target.value as CourtInput["environment"])}
        >
          <option value="outdoor">Outdoor</option>
          <option value="indoor">Indoor</option>
        </select>
      </div>

      {/* Open time */}
      <div>
        <label className="mb-1 block text-sm font-medium text-charcoal">Open time</label>
        <input
          type="time"
          className="w-full rounded-xl border border-surface bg-white px-3 py-2 text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-green"
          value={value.open_time}
          onChange={(e) => set("open_time", e.target.value)}
        />
      </div>

      {/* Close time */}
      <div>
        <label className="mb-1 block text-sm font-medium text-charcoal">Close time</label>
        <input
          type="time"
          className="w-full rounded-xl border border-surface bg-white px-3 py-2 text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-green"
          value={value.close_time}
          onChange={(e) => set("close_time", e.target.value)}
        />
      </div>

      {/* Sort order */}
      <div>
        <label className="mb-1 block text-sm font-medium text-charcoal">Sort order</label>
        <input
          type="number"
          min={0}
          className="w-full rounded-xl border border-surface bg-white px-3 py-2 text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-green"
          value={value.sort_order}
          onChange={(e) => set("sort_order", parseInt(e.target.value, 10) || 0)}
        />
      </div>

      {/* Status */}
      <div>
        <label className="mb-1 block text-sm font-medium text-charcoal">Status</label>
        <select
          className="w-full rounded-xl border border-surface bg-white px-3 py-2 text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-green"
          value={value.status}
          onChange={(e) => set("status", e.target.value as CourtInput["status"])}
        >
          <option value="active">Active</option>
          <option value="maintenance">Maintenance</option>
        </select>
      </div>

      {/* Lighting */}
      <div className="flex items-center gap-2 sm:col-span-2">
        <input
          id="lighting"
          type="checkbox"
          className="h-4 w-4 rounded border-surface accent-green"
          checked={value.lighting}
          onChange={(e) => set("lighting", e.target.checked)}
        />
        <label htmlFor="lighting" className="text-sm font-medium text-charcoal">
          Floodlights available
        </label>
      </div>

      {/* Blurb */}
      <div className="sm:col-span-2">
        <label className="mb-1 block text-sm font-medium text-charcoal">Blurb (optional)</label>
        <textarea
          rows={2}
          className="w-full rounded-xl border border-surface bg-white px-3 py-2 text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-green"
          value={value.blurb ?? ""}
          onChange={(e) => set("blurb", e.target.value || null)}
          placeholder="Short description shown to players"
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inline edit row for an existing court
// ---------------------------------------------------------------------------

function CourtRow({ court }: { court: Court }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [form, setForm] = useState<CourtInput>(() => courtToForm(court));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSave() {
    setError(null);
    startTransition(async () => {
      const result = await upsertCourtAction(form);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setEditing(false);
      router.refresh();
    });
  }

  function handleCancel() {
    setForm(courtToForm(court));
    setEditing(false);
    setError(null);
  }

  function handleDelete() {
    setError(null);
    startTransition(async () => {
      const result = await deleteCourtAction(court.id);
      if (!result.ok) {
        // Keep the dialog open so the reason (e.g. court has bookings) is visible.
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="rounded-card border border-surface bg-white p-4 shadow-soft">
      {/* Summary row */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="font-semibold text-charcoal">{court.name}</p>
          <p className="mt-0.5 text-sm text-charcoal/60">
            {court.surface} &middot; {court.environment}
            {court.lighting ? " &middot; lights" : ""} &middot; {court.open_time.slice(0, 5)}–{court.close_time.slice(0, 5)}
            &nbsp;
            <span
              className={
                court.status === "active"
                  ? "inline-flex items-center rounded-full bg-green-50 px-2 py-0.5 text-xs font-semibold text-green-600"
                  : "inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-600"
              }
            >
              {court.status}
            </span>
          </p>
        </div>
        {!editing && (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              Edit
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-red-600 hover:bg-red-50 hover:text-red-700"
              onClick={() => { setConfirmingDelete(true); setError(null); }}
            >
              Delete
            </Button>
          </div>
        )}
      </div>

      {/* Delete confirmation */}
      {confirmingDelete && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-medium text-charcoal">
            Delete <span className="font-semibold">{court.name}</span>? This also removes its
            empty slots and any closures. This cannot be undone.
          </p>
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
          <div className="mt-3 flex gap-2">
            <Button
              size="sm"
              className="bg-red-600 hover:bg-red-700"
              onClick={handleDelete}
              disabled={pending}
            >
              {pending ? "Deleting…" : "Delete court"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setConfirmingDelete(false)}
              disabled={pending}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Inline edit form */}
      {editing && (
        <div className="mt-4 border-t border-surface pt-4">
          <CourtFormFields value={form} onChange={setForm} />
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
          <div className="mt-4 flex gap-2">
            <Button size="sm" onClick={handleSave} disabled={pending}>
              {pending ? "Saving…" : "Save"}
            </Button>
            <Button variant="ghost" size="sm" onClick={handleCancel} disabled={pending}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Add-court form
// ---------------------------------------------------------------------------

function AddCourtForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<CourtInput>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSave() {
    setError(null);
    startTransition(async () => {
      const result = await upsertCourtAction(form);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setForm(EMPTY_FORM);
      setOpen(false);
      router.refresh();
    });
  }

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        + Add court
      </Button>
    );
  }

  return (
    <div className="rounded-card border border-surface bg-white p-4 shadow-soft">
      <p className="mb-4 font-semibold text-charcoal">New court</p>
      <CourtFormFields value={form} onChange={setForm} />
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      <div className="mt-4 flex gap-2">
        <Button size="sm" onClick={handleSave} disabled={pending}>
          {pending ? "Saving…" : "Add court"}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setOpen(false);
            setForm(EMPTY_FORM);
            setError(null);
          }}
          disabled={pending}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Public export
// ---------------------------------------------------------------------------

export function CourtEditor({ courts }: { courts: Court[] }) {
  return (
    <div className="space-y-3">
      {courts.length === 0 && (
        <div className="rounded-card border border-surface bg-white p-10 text-center shadow-soft">
          <p className="font-semibold text-charcoal">No courts yet</p>
          <p className="mt-1 text-sm text-charcoal/60">Add your first court below.</p>
        </div>
      )}
      {courts.map((c) => (
        <CourtRow key={c.id} court={c} />
      ))}
      <AddCourtForm />
    </div>
  );
}
