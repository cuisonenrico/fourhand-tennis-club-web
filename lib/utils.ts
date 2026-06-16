import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format cents as Philippine Peso (the club operates in PH). */
export function formatPrice(cents: number): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 0,
  }).format(cents / 100);
}

/** "06:00" → "6:00 AM" for display. */
export function formatTime(iso: string): string {
  return new Intl.DateTimeFormat("en-PH", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Manila",
  }).format(new Date(iso));
}

/** YYYY-MM-DD for a Date, in Manila time. */
export function toDateKey(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function todayKey(): string {
  return toDateKey(new Date());
}

/** "Wed, 1 Jul 2026" in Manila time. */
export function formatDateLong(iso: string): string {
  return new Intl.DateTimeFormat("en-PH", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Manila",
  }).format(new Date(iso));
}

/** "6:00 PM – 7:00 PM" in Manila time. */
export function formatTimeRange(startIso: string, endIso: string): string {
  return `${formatTime(startIso)} – ${formatTime(endIso)}`;
}

/**
 * UTC ISO bounds for a Manila calendar day (key = "YYYY-MM-DD").
 * Manila is a fixed UTC+8 with no DST, so the day is [key 00:00, +24h).
 */
export function manilaDayRange(dateKey: string): { startIso: string; endIso: string } {
  const start = new Date(`${dateKey}T00:00:00+08:00`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { startIso: start.toISOString(), endIso: end.toISOString() };
}

/** Date keys for the next `days` Manila days starting today (for the date picker). */
export function upcomingDateKeys(days: number): string[] {
  const keys: string[] = [];
  const base = new Date(`${todayKey()}T00:00:00+08:00`);
  for (let i = 0; i < days; i++) {
    keys.push(toDateKey(new Date(base.getTime() + i * 24 * 60 * 60 * 1000)));
  }
  return keys;
}
