"use client";

import { useState, type ReactNode } from "react";
import { SectionHeading } from "./section-heading";
import { Reveal } from "@/components/motion/reveal";
import { FACILITY_ZONES, type FacilityZone } from "@/lib/data/site";

type ZoneId = FacilityZone["id"];

/**
 * Stylised site plan that follows the real land outline: an angled lower-left
 * boundary, the lounge stepping up at the top, match courts on the right and
 * parking filling the slanted wedge on the left.
 */
const FOOTPRINT = "150,95 250,95 250,30 405,30 405,560 60,560 150,300";

/** Court-marking stroke colour, shared across zone detailing. */
const LINE = "rgba(255,255,255,0.85)";

type ZoneGeo = {
  /** Polygon that traces the zone's footprint. */
  points: string;
  /** Anchor for the zone label. */
  label: { x: number; y: number };
  /** Interior markings, clipped to the zone shape. */
  detail: ReactNode;
};

const GEOMETRY: Record<ZoneId, ZoneGeo> = {
  lounge: {
    points: "255,33 400,33 400,92 255,92",
    label: { x: 327, y: 50 },
    detail: loungeDetail(),
  },
  drills: {
    points: "160,110 400,110 400,182 160,182",
    label: { x: 280, y: 148 },
    detail: drillsDetail(),
  },
  courts: {
    points: "215,250 395,250 395,545 215,545",
    label: { x: 305, y: 398 },
    detail: courtsDetail(),
  },
  parking: {
    points: "150,250 200,250 200,545 65,545 150,300",
    label: { x: 138, y: 410 },
    detail: parkingDetail(),
  },
};

export function FacilityMap() {
  const [active, setActive] = useState<ZoneId>("courts");

  return (
    <section id="space" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
      <SectionHeading
        eyebrow="The space"
        title="Find your way around"
        description="From the car park to the courts to a cold drink after — here's how the club lays out."
      />

      <div className="mt-10 grid gap-8 lg:grid-cols-5 lg:items-stretch">
        <Reveal className="lg:col-span-3">
          <div className="h-full rounded-card bg-white p-4 shadow-soft sm:p-6">
            <svg
              viewBox="0 0 440 600"
              className="h-auto w-full"
              role="group"
              aria-label="Interactive site plan of the Fourhand Tennis Club"
            >
              <defs>
                <filter id="zone-shadow" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="#3e3e42" floodOpacity="0.18" />
                </filter>
                {FACILITY_ZONES.map((zone) => (
                  <clipPath key={zone.id} id={`clip-${zone.id}`}>
                    <polygon points={GEOMETRY[zone.id].points} />
                  </clipPath>
                ))}
              </defs>

              {/* Land / grounds outline */}
              <polygon
                points={FOOTPRINT}
                fill="#f4f3ef"
                stroke="#3e3e42"
                strokeOpacity={0.14}
                strokeWidth={2}
                strokeLinejoin="round"
              />

              {FACILITY_ZONES.map((zone) => {
                const g = GEOMETRY[zone.id];
                const isActive = active === zone.id;
                const label = `${zone.label} — ${zone.stat}`;
                return (
                  <g
                    key={zone.id}
                    role="button"
                    tabIndex={0}
                    aria-pressed={isActive}
                    aria-label={label}
                    onMouseEnter={() => setActive(zone.id)}
                    onFocus={() => setActive(zone.id)}
                    onClick={() => setActive(zone.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setActive(zone.id);
                      }
                    }}
                    className="cursor-pointer outline-none [transform-box:fill-box] [transform-origin:center]"
                    style={{
                      transform: isActive ? "scale(1.02)" : "scale(1)",
                      opacity: isActive ? 1 : 0.6,
                      transition: "transform 0.3s cubic-bezier(0.22,1,0.36,1), opacity 0.3s ease",
                    }}
                  >
                    <polygon
                      points={g.points}
                      fill={zone.color}
                      stroke="#ffffff"
                      strokeOpacity={0.5}
                      strokeWidth={1.5}
                      strokeLinejoin="round"
                      filter={isActive ? "url(#zone-shadow)" : undefined}
                    />
                    <g clipPath={`url(#clip-${zone.id})`}>{g.detail}</g>
                    <text
                      x={g.label.x}
                      y={g.label.y}
                      textAnchor="middle"
                      dominantBaseline="central"
                      className="pointer-events-none select-none font-sans"
                      fontSize={zone.id === "parking" ? 13 : 14}
                      fontWeight={700}
                      fill={zone.id === "parking" ? "#5c5300" : "#ffffff"}
                      stroke={zone.color}
                      strokeWidth={3.5}
                      strokeLinejoin="round"
                      paintOrder="stroke"
                    >
                      {zone.label.toUpperCase()}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        </Reveal>

        <Reveal delay={0.1} className="lg:col-span-2">
          <ul className="flex h-full flex-col gap-3">
            {FACILITY_ZONES.map((zone) => {
              const isActive = active === zone.id;
              return (
                <li key={zone.id} className="flex-1">
                  <button
                    type="button"
                    onMouseEnter={() => setActive(zone.id)}
                    onFocus={() => setActive(zone.id)}
                    onClick={() => setActive(zone.id)}
                    aria-pressed={isActive}
                    className={`flex h-full w-full flex-col gap-1.5 rounded-card border-l-4 p-4 text-left transition-all ${
                      isActive ? "shadow-soft" : "border-l-transparent bg-white shadow-soft hover:bg-surface/40"
                    }`}
                    style={
                      isActive
                        ? { borderLeftColor: zone.color, backgroundColor: zone.tint }
                        : undefined
                    }
                  >
                    <span className="flex items-center gap-2.5">
                      <span
                        className="h-3.5 w-3.5 shrink-0 rounded-full ring-2 ring-white"
                        style={{ backgroundColor: zone.color }}
                      />
                      <span className="font-semibold text-charcoal">{zone.label}</span>
                      <span className="ml-auto rounded-full bg-white/70 px-2 py-0.5 text-xs font-medium text-charcoal/70">
                        {zone.stat}
                      </span>
                    </span>
                    <span className="text-sm text-charcoal/70">{zone.description}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </Reveal>
      </div>
    </section>
  );
}

/* --- Zone interior detailing (drawn over the fill, clipped to each shape) --- */

function courtsDetail() {
  return (
    <g stroke={LINE} strokeWidth={2} fill="none">
      <rect x={227} y={262} width={156} height={271} rx={3} />
      {/* net line */}
      <line x1={227} y1={397} x2={383} y2={397} />
      {/* singles + court divisions */}
      <line x1={305} y1={262} x2={305} y2={533} strokeOpacity={0.55} />
      <line x1={227} y1={330} x2={383} y2={330} strokeOpacity={0.4} />
      <line x1={227} y1={465} x2={383} y2={465} strokeOpacity={0.4} />
    </g>
  );
}

function drillsDetail() {
  return (
    <g stroke={LINE} strokeWidth={2} fill="none">
      <rect x={170} y={120} width={220} height={52} rx={3} />
      <line x1={280} y1={120} x2={280} y2={172} />
      <line x1={225} y1={120} x2={225} y2={172} strokeOpacity={0.4} />
      <line x1={335} y1={120} x2={335} y2={172} strokeOpacity={0.4} />
    </g>
  );
}

function parkingDetail() {
  const bays = [280, 320, 360, 400, 440, 480, 520];
  const stroke = "rgba(92,83,0,0.45)";
  return (
    <g stroke={stroke} strokeWidth={2}>
      {/* central aisle */}
      <line x1={134} y1={252} x2={134} y2={543} strokeOpacity={0.7} />
      {/* parking bays */}
      {bays.map((y) => (
        <line key={y} x1={60} y1={y} x2={200} y2={y} />
      ))}
    </g>
  );
}

function loungeDetail() {
  const top = 68;
  const seats = [275, 318, 361];
  return (
    <g fill="rgba(255,255,255,0.85)">
      {seats.map((x) => (
        <rect key={x} x={x} y={top} width={24} height={14} rx={3} />
      ))}
      {seats.map((x) => (
        <circle key={`c-${x}`} cx={x + 12} cy={top - 7} r={4} />
      ))}
    </g>
  );
}
