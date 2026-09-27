import { useEffect, useState } from "react";
import { redirect, useLoaderData, useNavigate } from "react-router";
import type { Route } from "./+types/driver";
import { driverNav } from "../components/TopNav";
import { apiUrl } from "../lib/api";
import { getAuth } from "../lib/auth.client";
import { authFetch, authJson } from "../lib/fetch.client";
import { formatPaisa, formatRideType } from "../lib/format";
import type { DriverRide, RideRequest, Zone } from "../lib/types";

type RequestStack = {
  key: string;
  pickupZone: Zone;
  destinationZone: Zone;
  type: RideRequest["type"];
  capacity: number;
  waitingCount: number;
  acceptCount: number;
  acceptSeats: number;
  totalFarePaisa: number;
  acceptRequestIds: string[];
  passengers: {
    requestId: string;
    name: string;
    farePaisa: number;
    seatsRequested: number;
  }[];
};

type DriverProfile = {
  driver: {
    isOnline: boolean;
    offlineQueued: boolean;
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
    offlineQueued: profile.driver?.offlineQueued ?? false,
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
  const [offlineQueued, setOfflineQueued] = useState(loaderData.offlineQueued);
  const [rides, setRides] = useState(loaderData.rides);
  const [stacks, setStacks] = useState<RequestStack[]>([]);
  const [saving, setSaving] = useState(false);
  const [actingRideId, setActingRideId] = useState<string | null>(null);
  const [acceptingKey, setAcceptingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const [list, open, me] = await Promise.all([
          authJson<{ rides: DriverRide[] }>("/driver/rides"),
          authJson<{ stacks: RequestStack[] }>("/driver/requests"),
          authJson<{ user: DriverProfile }>("/auth/driver/me"),
        ]);
        if (!cancelled) {
          setRides(list.rides.filter(isActiveRide));
          setStacks(open.stacks);
          setIsOnline(me.user.driver?.isOnline ?? false);
          setOfflineQueued(me.user.driver?.offlineQueued ?? false);
        }
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
      setOfflineQueued(body.user.driver?.offlineQueued ?? false);
      setSelectedZones(body.user.driver?.activeZoneIds ?? []);
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

  async function stayOnline() {
    setSaving(true);
    setError(null);
    try {
      const res = await authFetch("/driver/status/stay-online", { method: "POST" });
      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(err?.error ?? "Could not stay online");
      }
      const body = (await res.json()) as { user: DriverProfile };
      setIsOnline(body.user.driver?.isOnline ?? true);
      setOfflineQueued(body.user.driver?.offlineQueued ?? false);
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

  async function acceptStack(stack: RequestStack) {
    setAcceptingKey(stack.key);
    setError(null);
    try {
      const res = await authFetch("/driver/request-stacks/accept", {
        method: "POST",
        body: JSON.stringify({
          pickupZoneId: stack.pickupZone.id,
          destinationZoneId: stack.destinationZone.id,
          type: stack.type,
        }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(err?.error ?? "Could not accept");
      }
      const [list, open] = await Promise.all([
        authJson<{ rides: DriverRide[] }>("/driver/rides"),
        authJson<{ stacks: RequestStack[] }>("/driver/requests"),
      ]);
      setRides(list.rides.filter(isActiveRide));
      setStacks(open.stacks);
    } catch (err) {
      if (err instanceof Response && err.status === 401) {
        void navigate("/login");
        return;
      }
      setError(err instanceof Error ? err.message : "Could not accept");
    } finally {
      setAcceptingKey(null);
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
    <main className="page">
      {driverNav(loaderData.name)}

      {loaderData.tesla ? (
        <p className="mt-2 text-sm text-gray-600">
          {loaderData.tesla.name} · {loaderData.tesla.capacity} seats
        </p>
      ) : null}

      <section className="card space-y-3">
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
            onClick={() => void (offlineQueued ? stayOnline() : saveStatus(false))}
            className="btn-secondary w-full"
          >
            {saving
              ? "Updating…"
              : offlineQueued
                ? "Stay online"
                : rides.length > 0
                  ? "Go offline after this ride"
                  : "Go offline"}
          </button>
        ) : (
          <button
            type="button"
            disabled={saving || selectedZones.length === 0}
            onClick={() => void saveStatus(true)}
            className="btn-primary w-full disabled:opacity-50"
          >
            {saving ? "Updating…" : "Go online"}
          </button>
        )}
        {offlineQueued ? (
          <p className="text-sm text-gray-700">
            Going offline after this ride. Finish the trip, and you will not take a new one.
          </p>
        ) : null}
      </section>

      {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}

      <section className="mt-6">
        <h2 className="font-semibold">Incoming requests</h2>
        {!isOnline ? (
          <p className="mt-2 text-sm text-gray-600">Go online to see pickup requests.</p>
        ) : stacks.length === 0 ? (
          <p className="mt-2 text-sm text-gray-600">
            No requests in your zones right now. Same pickup and destination stack together.
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {stacks.map((stack) => {
              const busy = acceptingKey === stack.key || rides.length > 0 || offlineQueued;
              const overflow = stack.waitingCount - stack.acceptCount;
              return (
                <li key={stack.key} className="card text-sm">
                  <p className="text-base font-semibold">
                    {stack.pickupZone.name} → {stack.destinationZone.name}
                  </p>
                  <p className="mt-1 text-gray-600">
                    {formatRideType(stack.type)} · {stack.acceptCount} of {stack.waitingCount}{" "}
                    passenger{stack.waitingCount === 1 ? "" : "s"} · {stack.acceptSeats}/
                    {stack.capacity} seats
                    {overflow > 0 ? ` · ${overflow} wait for the next car` : ""}
                  </p>
                  <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                    You earn
                  </p>
                  <p className="text-2xl font-bold">{formatPaisa(stack.totalFarePaisa)}</p>
                  <ul className="mt-3 space-y-1">
                    {stack.passengers.map((passenger) => {
                      const included = stack.acceptRequestIds.includes(passenger.requestId);
                      return (
                        <li key={passenger.requestId} className="flex justify-between gap-2">
                          <span className={included ? "" : "text-gray-400"}>
                            {passenger.name}
                            {passenger.seatsRequested > 1
                              ? ` · ${passenger.seatsRequested} seats`
                              : ""}
                            {included ? "" : " · next car"}
                          </span>
                          <span className="font-semibold">{formatPaisa(passenger.farePaisa)}</span>
                        </li>
                      );
                    })}
                  </ul>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void acceptStack(stack)}
                    className="btn-primary mt-3 w-full disabled:opacity-50"
                  >
                    {acceptingKey === stack.key
                      ? "Accepting…"
                      : offlineQueued
                        ? "Going offline after this ride"
                        : rides.length > 0
                          ? "Finish your current ride first"
                          : stack.acceptCount > 1
                          ? `Accept pool · ${formatPaisa(stack.totalFarePaisa)}`
                          : `Accept · ${formatPaisa(stack.totalFarePaisa)}`}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="mt-6">
        <h2 className="font-semibold">Active rides</h2>
        {rides.length === 0 ? (
          <p className="mt-2 text-sm text-gray-600">
            No ride yet. Accept a request above to start one.
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {rides.map((ride) => {
              const busy = actingRideId === ride.id;
              const canArrive = ride.status === "MATCHED" && !ride.arrivedAt;
              const canStart = ride.status === "MATCHED" && ride.arrivedAt && !ride.startedAt;
              const canComplete = ride.status === "IN_PROGRESS" && !ride.completedAt;
              return (
                <li key={ride.id} className="card text-sm">
                  <p className="font-semibold">{ride.pickupZone.name}</p>
                  <p className="mt-1 text-gray-600">
                    {formatRideType(ride.type)} · {ride.seatsTaken}/{ride.capacity} seats ·{" "}
                    {ride.status}
                  </p>
                  <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Your earnings
                  </p>
                  <p className="text-2xl font-bold">{formatPaisa(ride.totalFarePaisa ?? 0)}</p>
                  {ride.passengers.length > 0 ? (
                    <ul className="mt-2 space-y-1">
                      {ride.passengers.map((passenger) => (
                        <li key={passenger.name} className="flex justify-between gap-2">
                          <span>{passenger.name}</span>
                          <span className="font-semibold">{formatPaisa(passenger.farePaisa)}</span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  <div className="mt-3 flex flex-col gap-2">
                    {canArrive ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void lifecycle(ride.id, "arrive")}
                        className="btn-primary w-full"
                      >
                        {busy ? "Updating…" : "Mark arrived"}
                      </button>
                    ) : null}
                    {canStart ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void lifecycle(ride.id, "start")}
                        className="btn-primary w-full"
                      >
                        {busy ? "Updating…" : "Start ride"}
                      </button>
                    ) : null}
                    {canComplete ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void lifecycle(ride.id, "complete")}
                        className="btn-primary w-full"
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
