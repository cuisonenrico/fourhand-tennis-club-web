/**
 * Static marketing content for the landing page.
 *
 * IMAGE SWAP POINTS: `image` URLs are Unsplash placeholders. Replace each with
 * real Fourhand court photography served from Supabase Storage, e.g.
 *   `${NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/courts/court-1.jpg`
 * (Plan §11.3 — real photos, not stock, carry these pages.)
 */

export interface ShowcaseCourt {
  name: string;
  surface: "Hard" | "Clay" | "Grass";
  environment: "Indoor" | "Outdoor";
  lighting: string;
  image: string;
}

export const SHOWCASE_COURTS: ShowcaseCourt[] = [
  {
    name: "Court 1 — Centre",
    surface: "Hard",
    environment: "Outdoor",
    lighting: "Floodlit",
    image: "https://images.unsplash.com/photo-1554068865-24cecd4e34b8?auto=format&fit=crop&w=1200&q=70",
  },
  {
    name: "Court 3 — Indoor",
    surface: "Hard",
    environment: "Indoor",
    lighting: "All-day",
    image: "https://images.unsplash.com/photo-1622279457486-62dcc4a431d6?auto=format&fit=crop&w=1200&q=70",
  },
  {
    name: "Court 5 — Clay",
    surface: "Clay",
    environment: "Outdoor",
    lighting: "Floodlit",
    image: "https://images.unsplash.com/photo-1595435934249-5df7ed86e1c0?auto=format&fit=crop&w=1200&q=70",
  },
  {
    name: "Court 6 — Grass",
    surface: "Grass",
    environment: "Outdoor",
    lighting: "Daytime",
    image: "https://images.unsplash.com/photo-1530915365347-e35b749a0381?auto=format&fit=crop&w=1200&q=70",
  },
];

export interface Amenity {
  title: string;
  description: string;
  icon: "Store" | "CircleDot" | "Zap" | "ShowerHead" | "Car" | "Coffee";
}

export const AMENITIES: Amenity[] = [
  { title: "Pro shop", description: "Strings, grips, apparel and expert restringing.", icon: "Store" },
  { title: "Racket & ball hire", description: "Turn up empty-handed — we've got you covered.", icon: "CircleDot" },
  { title: "Ball machine", description: "Drill your groundstrokes solo, by the hour.", icon: "Zap" },
  { title: "Changing rooms", description: "Lockers, showers and a place to freshen up.", icon: "ShowerHead" },
  { title: "Parking", description: "Free on-site parking right by the courts.", icon: "Car" },
  { title: "Café", description: "Coffee, cold drinks and post-match snacks.", icon: "Coffee" },
];

export const HERO_IMAGE =
  "https://images.unsplash.com/photo-1542144582-1ba00456b5e3?auto=format&fit=crop&w=2000&q=75";

export const ABOUT_IMAGE =
  "https://images.unsplash.com/photo-1617083934555-ac7b4c0e7d6a?auto=format&fit=crop&w=1200&q=70";

export interface TeaserEvent {
  type: "Competition" | "Class" | "Workshop";
  title: string;
  blurb: string;
  when: string;
  spots: string;
}

/**
 * SWAP POINT: static event previews mirroring supabase/seed.sql. Wire to the
 * live `events` table once the events module (a later phase) is built.
 */
export const TEASER_EVENTS: TeaserEvent[] = [
  {
    type: "Competition",
    title: "Summer Singles Ladder",
    blurb: "Six-week singles ladder across all levels. Weekly fixtures, trophies for the top three.",
    when: "Starts in 10 days",
    spots: "32 spots",
  },
  {
    type: "Class",
    title: "Adult Beginners Clinic",
    blurb: "Four weeks of coached fundamentals — grips, footwork, rallying. Rackets provided.",
    when: "Starts in 5 days",
    spots: "12 spots",
  },
  {
    type: "Workshop",
    title: "Serve & Volley Masterclass",
    blurb: "A two-hour intensive on first-strike tennis with our head coach.",
    when: "In 7 days",
    spots: "8 spots",
  },
];
