import type { Config } from "@react-router/dev/config";

export default {
  // Keep SSR so Docker (`react-router-serve`) and the Vercel server build stay valid.
  ssr: true,
  // Ship every route in the first document so tab changes skip the /__manifest round trip.
  routeDiscovery: { mode: "initial" },
} satisfies Config;
