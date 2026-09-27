/**
 * Static diagram of the road network. These x/y values are not the database coordinates.
 *
 *   Banani —— Mohakhali —— Gulshan 1 —— Bashundhara
 *                 |
 *              Farmgate
 *                 |
 *               Mirpur
 *
 * Main corridor runs Banani → Bashundhara. Mirpur joins at Mohakhali.
 */
export const ZONE_NETWORK = [
  { name: "Banani", x: 70, y: 90 },
  { name: "Mohakhali", x: 190, y: 90 },
  { name: "Gulshan 1", x: 310, y: 90 },
  { name: "Bashundhara", x: 430, y: 90 },
  { name: "Farmgate", x: 190, y: 190 },
  { name: "Mirpur", x: 190, y: 290 },
] as const;

/** Undirected road segments between zones. */
export const ZONE_ROADS: [string, string][] = [
  ["Banani", "Mohakhali"],
  ["Mohakhali", "Gulshan 1"],
  ["Gulshan 1", "Bashundhara"],
  ["Mohakhali", "Farmgate"],
  ["Farmgate", "Mirpur"],
];

export const MAP_VIEW = { width: 500, height: 360, pad: 28 } as const;
