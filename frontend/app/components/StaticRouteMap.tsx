import { MAP_VIEW, ZONE_NETWORK, ZONE_ROADS } from "../lib/geo";

type ZoneNode = (typeof ZONE_NETWORK)[number];

/** Static zone diagram. No live trip, distance, or location. */
export function StaticRouteMap() {
  const { width, height } = MAP_VIEW;
  const byName = new Map<string, ZoneNode>(ZONE_NETWORK.map((zone) => [zone.name, zone]));

  const roads = ZONE_ROADS.flatMap(([from, to]) => {
    const start = byName.get(from);
    const end = byName.get(to);
    if (!start || !end) return [];
    return [[start, end] as const];
  });

  const hub = byName.get("Mohakhali");

  return (
    <div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full rounded border bg-slate-50"
        role="img"
        aria-label="Dhaka Tesla Pool zone roadmap"
      >
        {roads.map(([start, end]) => (
          <line
            key={`${start.name}-${end.name}`}
            x1={start.x}
            y1={start.y}
            x2={end.x}
            y2={end.y}
            stroke="#94a3b8"
            strokeWidth={8}
            strokeLinecap="round"
          />
        ))}

        {hub ? (
          <circle cx={hub.x} cy={hub.y} r={18} fill="none" stroke="#059669" strokeWidth={2} />
        ) : null}

        {ZONE_NETWORK.map((zone) => {
          const isHub = zone.name === "Mohakhali";
          const labelBelow = zone.y > 150;
          return (
            <g key={zone.name}>
              <circle cx={zone.x} cy={zone.y} r={isHub ? 9 : 7} fill={isHub ? "#047857" : "#0f172a"} />
              <text
                x={zone.x}
                y={labelBelow ? zone.y + 22 : zone.y - 14}
                textAnchor="middle"
                fontSize={13}
                fill="#111827"
              >
                {zone.name}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="mt-4 space-y-2 text-sm text-gray-600">
        <p>
          <span className="font-semibold text-gray-900">Main road:</span> Banani → Mohakhali →
          Gulshan 1 → Bashundhara
        </p>
        <p>
          <span className="font-semibold text-gray-900">Side road:</span> Mirpur → Farmgate →
          joins at Mohakhali
        </p>
        <p className="text-xs text-gray-500">
          Mirpur to Bashundhara crosses Farmgate, Mohakhali, and Gulshan 1. Gulshan 1 is on the
          Banani → Bashundhara road, so those trips can share a pool. Mirpur is not.
        </p>
      </div>
    </div>
  );
}
