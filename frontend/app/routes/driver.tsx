import { useEffect, useState } from "react";
import { redirect, useLoaderData, useNavigate } from "react-router";
import type { Route } from "./+types/driver";
import { apiUrl } from "../lib/api";
import { clearAuth, getAuth } from "../lib/auth.client";
import { authFetch, authJson } from "../lib/fetch.client";
import { formatRideType } from "../lib/format";
import type { DriverRide, Zone } from "../lib/types";

type DriverProfile = {
  driver: {
    isOnline: boolean;
    activeZoneIds: number[];
    teslas: { name: string; capacity: number; isActive: boolean }[];
  } | null;
};

export function meta({}: Route.MetaArgs) {
  return [{ title: "Driver · Oi Tesla" }];
}

function isActiveRide(ride: DriverRide) {
  return ride.status !== "COMPLETED" && ride.status !== "CANCELLED";
}

export async function clientLoader() {
  const auth = getAuth();
  if (!auth || auth.role !== "DRIVER") {
    throw redirect("/login");
  }

  const zonesRes = await fetch(apiUrl("/zones"));
  const zonesData = (await zonesRes.json()) as { zones: Zone[] };

  let profile: DriverProfile = { driver: null };
  let rides: DriverRide[] = [];
  try {
    const me = await authJson<{ user: DriverProfile }>("/auth/driver/me");
    profile = me.user;
    const list = await authJson<{ rides: DriverRide[] }>("/driver/rides");
    rides = list.rides.filter(isActiveRide);
  } catch (err) {
    if (err instanceof Response) throw err;
  }

  return {
    name: auth.name,
    zones: zonesData.zones,
    isOnline: profile.driver?.isOnline ?? false,
    activeZoneIds: profile.driver?.activeZoneIds ?? [],
    tesla: profile.driver?.teslas.find((t) => t.isActive) ?? null,
    rides,
  };
}

export default function DriverHome() {
  const loaderData = useLoaderData<typeof clientLoader>();
  const navigate = useNavigate();

  const [selectedZones, setSelectedZones] = useState<number[]>(loaderData.activeZoneIds);
  const [isOnline, setIsOnline] = useState(loaderData.isOnline);
  const [rides, setRides] = useState(loaderData.rides);
  const [saving, setSaving] = useState(false);
  const [actingRideId, setActingRideId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const list = await authJson<{ rides: DriverRide[] }>("/driver/rides");
        if (!cancelled) setRides(list.rides.filter(isActiveRide));
      } catch {
        // ignore a missed poll
      }
    }

    void poll();
    const id = window.setInterval(() => void poll(), 3000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  function logout() {
    clearAuth();
    void navigate("/login");
  }

  function toggleZone(zoneId: number) {
    setSelectedZones((current) =>
      current.includes(zoneId)
        ? current.filter((id) => id !== zoneId)
        : [...current, zoneId],
    );
  }

  async function saveStatus(nextOnline: boolean) {
    setSaving(true);
    setError(null);
    try {
      const res = await authFetch("/driver/status", {
        method: "PATCH",
        body: JSON.stringify({
          isOnline: nextOnline,
          zoneIds: nextOnline ? selectedZones : undefined,
        }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(err?.error ?? "Could not update status");
      }
      const body = (await res.json()) as { user: DriverProfile };
      setIsOnline(body.user.driver?.isOnline ?? nextOnline);
      if (body.user.driver?.isOnline) {
        setSelectedZones(body.user.driver.activeZoneIds);
      }
    } catch (err) {
      if (err instanceof Response && err.status === 401) {
        void navigate("/login");
        return;
      }
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setSaving(false);
    }
  }

  async function lifecycle(rideId: string, action: "arrive" | "start" | "complete") {
    setActingRideId(rideId);
    setError(null);
    try {
      const res = await authFetch(`/driver/rides/${rideId}/${action}`, {
        method: "PATCH",
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(err?.error ?? "Action failed");
      }
      const body = (await res.json()) as { ride: DriverRide };
      setRides((current) =>
        current
          .map((ride) => (ride.id === rideId ? body.ride : ride))
          .filter(isActiveRide),
      );
    } catch (err) {
      if (err instanceof Response && err.status === 401) {
        void navigate("/login");
        return;
      }
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setActingRideId(null);
    }
  }

  return (
    <main className="mx-auto max-w-lg p-6 pt-16">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Hi, {loaderData.name}</h1>
        <button type="button" onClick={logout} className="text-sm text-blue-600">
          Logout
        </button>
      </div>

      {loaderData.tesla ? (
        <p className="mt-2 text-sm text-gray-600">
          {loaderData.tesla.name} · {loaderData.tesla.capacity} seats
        </p>
      ) : null}

      <section className="mt-6 space-y-3 rounded border p-4">
        <p className="font-semibold">{isOnline ? "You are online" : "You are offline"}</p>
        <p className="text-sm text-gray-600">Pick the zones you can pick up from.</p>
        <ul className="space-y-2 text-sm">
          {loaderData.zones.map((zone) => (
            <li key={zone.id}>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={selectedZones.includes(zone.id)}
                  onChange={() => toggleZone(zone.id)}
                  disabled={isOnline || saving}
                />
                {zone.name}
              </label>
            </li>
          ))}
        </ul>
        {isOnline ? (
          <button
            type="button"
            disabled={saving}
            onClick={() => void saveStatus(false)}
            className="w-full rounded border py-2"
          >
            {saving ? "Updating…" : "Go offline"}
          </button>
        ) : (
          <button
            type="button"
            disabled={saving || selectedZones.length === 0}
            onClick={() => void saveStatus(true)}
            className="w-full rounded bg-gray-900 py-2 text-white disabled:opacity-50"
          >
            {saving ? "Updating…" : "Go online"}
          </button>
        )}
      </section>

      {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}

      <section className="mt-6">
        <h2 className="font-semibold">Active rides</h2>
        {rides.length === 0 ? (
          <p className="mt-2 text-sm text-gray-600">
            No ride yet. Go online, then a passenger booking in your zones can match you.
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {rides.map((ride) => {
              const busy = actingRideId === ride.id;
              const canArrive = ride.status === "MATCHED" && !ride.arrivedAt;
              const canStart = ride.status === "MATCHED" && ride.arrivedAt && !ride.startedAt;
              const canComplete = ride.status === "IN_PROGRESS" && !ride.completedAt;
              return (
                <li key={ride.id} className="rounded border p-4 text-sm">
                  <p className="font-semibold">{ride.pickupZone.name}</p>
                  <p className="mt-1 text-gray-600">
                    {formatRideType(ride.type)} · {ride.seatsTaken}/{ride.capacity} seats ·{" "}
                    {ride.status}
                  </p>
                  <div className="mt-3 flex flex-col gap-2">
                    {canArrive ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void lifecycle(ride.id, "arrive")}
                        className="rounded bg-gray-900 py-2 text-white"
                      >
                        {busy ? "Updating…" : "Mark arrived"}
                      </button>
                    ) : null}
                    {canStart ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void lifecycle(ride.id, "start")}
                        className="rounded bg-gray-900 py-2 text-white"
                      >
                        {busy ? "Updating…" : "Start ride"}
                      </button>
                    ) : null}
                    {canComplete ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void lifecycle(ride.id, "complete")}
                        className="rounded bg-gray-900 py-2 text-white"
                      >
                        {busy ? "Updating…" : "Complete ride"}
                      </button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
