import { apiUrl } from "./api";
import type { Zone } from "./types";

let zonesPromise: Promise<Zone[]> | null = null;

/** Zones do not change during a session. Reuse the first successful fetch. */
export function loadZones(): Promise<Zone[]> {
  if (!zonesPromise) {
    zonesPromise = fetch(apiUrl("/zones"))
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(`Failed to load zones (${res.status})`);
        }
        const data = (await res.json()) as { zones: Zone[] };
        return data.zones;
      })
      .catch((err: unknown) => {
        zonesPromise = null;
        throw err;
      });
  }
  return zonesPromise;
}
