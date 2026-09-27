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
    <div className="route-map">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full overflow-visible rounded-2xl bg-slate-50 ring-1 ring-slate-200"
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
            className="route-road-static"
          />
        ))}

        {hub ? <circle cx={hub.x} cy={hub.y} r={18} className="route-junction" /> : null}

        {ZONE_NETWORK.map((zone) => {
          const isHub = zone.name === "Mohakhali";
          const labelBelow = zone.y > 150;
          return (
            <g key={zone.name}>
              <circle
                cx={zone.x}
                cy={zone.y}
                r={isHub ? 9 : 7}
                className={isHub ? "route-node-hub" : "route-node-static"}
              />
              <text
                x={zone.x}
                y={labelBelow ? zone.y + 22 : zone.y - 14}
                textAnchor="middle"
                className="route-label-static"
              >
                {zone.name}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
