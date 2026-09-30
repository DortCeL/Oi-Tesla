import { useEffect, useState } from "react";
import { redirect, useLoaderData, useNavigate } from "react-router";
import type { Route } from "./+types/driver";
import { MultiChoiceTabs } from "../components/ChoiceTabs";
import { DriverRideBanner } from "../components/DriverRideBanner";
import { PassengerList } from "../components/PassengerList";
import { SeatMeter } from "../components/SeatMeter";
import { StatusBadge } from "../components/StatusBadge";
import { driverNav } from "../components/TopNav";
import { getAuth } from "../lib/auth.client";
import { loadZones } from "../lib/zones";
import { authFetch, authJson } from "../lib/fetch.client";
import { formatPaisa, formatRideType } from "../lib/format";
import { describePoolFill } from "../lib/rideCopy";
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

  const [zones, session] = await Promise.all([
    loadZones(),
    (async () => {
      try {
        const [me, list] = await Promise.all([
          authJson<{ user: DriverProfile }>("/auth/driver/me"),
          authJson<{ rides: DriverRide[] }>("/driver/rides"),
        ]);
        return {
          profile: me.user,
          rides: list.rides.filter(isActiveRide),
        };
      } catch (err) {
        if (err instanceof Response) throw err;
        return { profile: { driver: null } satisfies DriverProfile, rides: [] as DriverRide[] };
      }
    })(),
  ]);

  const { profile, rides } = session;

  return {
    name: auth.name,
    zones,
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
  const [zonesOpen, setZonesOpen] = useState(false);
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
          if (me.user.driver?.isOnline) {
            setSelectedZones(me.user.driver.activeZoneIds ?? []);
          }
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
      setZonesOpen(false);
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
          stackKey: stack.key,
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

  const hasActiveRide = rides.length > 0;
  const activeZoneNames = loaderData.zones
    .filter((zone) => selectedZones.includes(zone.id))
    .map((zone) => zone.name);
  const zoneOptions = loaderData.zones.map((zone) => ({
    value: zone.id,
    label: zone.name,
  }));

  return (
    <main className="page">
      {driverNav(loaderData.name)}

      <section className={`card mb-6 ${hasActiveRide && isOnline ? "py-4" : ""}`}>
        {hasActiveRide && isOnline ? (
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <span className="status-signal-sm online" aria-hidden />
              <div className="min-w-0">
                <p className="font-semibold text-gray-900">Online</p>
                {activeZoneNames.length > 0 ? (
                  <p className="truncate text-xs text-emerald-800">
                    {activeZoneNames.join(" · ")}
                  </p>
                ) : null}
              </div>
            </div>
            {!offlineQueued ? (
              <button
                type="button"
                disabled={saving}
                onClick={() => void saveStatus(false)}
                className="btn-secondary shrink-0 px-3 py-1.5 text-xs"
              >
                Go offline after ride
              </button>
            ) : (
              <button
                type="button"
                disabled={saving}
                onClick={() => void stayOnline()}
                className="btn-secondary shrink-0 px-3 py-1.5 text-xs"
              >
                Stay online
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="status-hero">
              <span
                className={`status-signal-lg ${isOnline ? "online" : "offline"}`}
                aria-hidden
              />
              <h2 className="status-hero-title">
                {isOnline ? "You are Online" : "You are Offline"}
              </h2>
            </div>

            {isOnline && activeZoneNames.length > 0 ? (
              <p className="mb-4 text-center text-sm font-medium text-emerald-800">
                {activeZoneNames.join(" · ")}
              </p>
            ) : null}

            {isOnline ? (
              <button
                type="button"
                disabled={saving}
                onClick={() => void saveStatus(false)}
                className="btn-secondary w-full py-3 text-base font-semibold"
              >
                Go offline
              </button>
            ) : !zonesOpen ? (
              <button
                type="button"
                onClick={() => {
                  setSelectedZones([]);
                  setZonesOpen(true);
                }}
                className="btn-primary w-full py-3 text-base font-semibold"
              >
                Go online
              </button>
            ) : (
              <div className="space-y-4 border-t border-gray-100 pt-5">
                <MultiChoiceTabs
                  label="Where can you pick up passengers?"
                  values={selectedZones}
                  onChange={setSelectedZones}
                  options={zoneOptions}
                />
                <button
                  type="button"
                  disabled={saving || selectedZones.length === 0}
                  onClick={() => void saveStatus(true)}
                  className="btn-primary w-full py-3 text-base font-semibold"
                >
                  {saving ? "Going online…" : "Confirm & go online"}
                </button>
                <button
                  type="button"
                  onClick={() => setZonesOpen(false)}
                  className="btn-secondary w-full"
                >
                  Cancel
                </button>
              </div>
            )}
          </>
        )}

        {offlineQueued ? (
          <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
            <p className="font-semibold">Going offline after this ride</p>
            <p className="mt-0.5 text-xs text-amber-900/80">
              Keep filling this pool and finish the trip. No new rides after that.
              You will go offline automatically.
            </p>
          </div>
        ) : null}

        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
      </section>

      <section className="mb-6">
        <h2 className="mb-3 text-lg font-semibold">Your Tesla right now</h2>
        {rides.length === 0 ? (
          <div className="card text-center">
            <p className="text-4xl" aria-hidden>
              🛺
            </p>
            <p className="mt-2 font-medium text-gray-800">No passengers yet</p>
            <p className="mt-1 text-sm text-gray-500">
              Accept an incoming request below to start a ride.
            </p>
          </div>
        ) : (
          <ul className="space-y-4">
            {rides.map((ride) => {
              const canArrive = ride.status === "MATCHED" && !ride.arrivedAt;
              const canStart =
                ride.status === "MATCHED" && !!ride.arrivedAt && !ride.startedAt;
              const canComplete = ride.status === "IN_PROGRESS" && !ride.completedAt;
              const busy = actingRideId === ride.id;
              const hasAction = canArrive || canStart || canComplete;

              return (
                <li key={ride.id} className="space-y-3">
                  <DriverRideBanner ride={ride} />

                  {hasAction ? (
                    <div className="flex flex-col gap-2">
                      {canArrive ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void lifecycle(ride.id, "arrive")}
                          className="btn-primary w-full py-3 text-base font-semibold"
                        >
                          {busy ? "Updating…" : "Mark arrived at pickup"}
                        </button>
                      ) : null}
                      {canStart ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void lifecycle(ride.id, "start")}
                          className="btn-primary w-full py-3 text-base font-semibold"
                        >
                          {busy ? "Updating…" : "Start ride"}
                        </button>
                      ) : null}
                      {canComplete ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void lifecycle(ride.id, "complete")}
                          className="btn-primary w-full py-3 text-base font-semibold"
                        >
                          {busy ? "Updating…" : "Complete ride"}
                        </button>
                      ) : null}
                    </div>
                  ) : null}

                  <div className="card">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-emerald-800">Pickup</p>
                        <p className="text-xl font-bold text-gray-900">{ride.pickupZone.name}</p>
                        <p className="mt-1 text-sm text-gray-600">{describePoolFill(ride)}</p>
                      </div>
                      <StatusBadge status={ride.status} />
                    </div>

                    <div className="mt-4">
                      <SeatMeter seatsTaken={ride.seatsTaken} capacity={ride.capacity} />
                    </div>

                    {(ride.totalFarePaisa ?? 0) > 0 ? (
                      <div className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 ring-1 ring-emerald-100">
                        <p className="text-xs font-bold uppercase tracking-wide text-emerald-800">
                          Your earnings
                        </p>
                        <p className="mt-0.5 text-2xl font-bold text-emerald-950">
                          {formatPaisa(ride.totalFarePaisa ?? 0)}
                        </p>
                      </div>
                    ) : null}

                    <div className="mt-4">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Passengers
                      </p>
                      <PassengerList
                        passengers={ride.passengers ?? []}
                        emptyMessage="Waiting for passengers to join…"
                      />
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {isOnline ? (
        <section>
          <h2 className="mb-3 text-lg font-semibold">Incoming routes</h2>
          {stacks.length === 0 ? (
            <div className="card text-sm text-gray-500">
              No open requests in your zones.
            </div>
          ) : (
            <ul className="space-y-3">
              {stacks.map((stack) => {
                const canAccept = rides.length === 0 && !offlineQueued;
                const overflow =
                  stack.waitingCount > stack.acceptCount
                    ? stack.waitingCount - stack.acceptCount
                    : 0;
                const separatePool = stacks.some(
                  (other) =>
                    other.key !== stack.key &&
                    other.pickupZone.id === stack.pickupZone.id &&
                    other.destinationZone.id === stack.destinationZone.id &&
                    other.type === stack.type,
                );
                return (
                  <li key={stack.key} className="card">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-lg font-bold text-gray-900">
                          {stack.pickupZone.name} → {stack.destinationZone.name}
                        </p>
                        <p className="mt-0.5 text-sm text-gray-500">
                          {formatRideType(stack.type)} · {stack.acceptCount} of{" "}
                          {stack.waitingCount} passenger
                          {stack.waitingCount === 1 ? "" : "s"} · {stack.acceptSeats}/
                          {stack.capacity} seats
                          {overflow > 0 ? ` · ${overflow} for the next car` : ""}
                        </p>
                      </div>
                      <p className="shrink-0 text-right">
                        <span className="block text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                          Earn
                        </span>
                        <span className="text-lg font-bold text-emerald-800">
                          {formatPaisa(stack.totalFarePaisa)}
                        </span>
                      </p>
                    </div>


                    <ul className="mt-3 space-y-1 rounded-xl bg-gray-50 px-3 py-2 ring-1 ring-gray-100">
                      {stack.passengers.map((passenger) => {
                        const included = stack.acceptRequestIds.includes(passenger.requestId);
                        return (
                          <li
                            key={passenger.requestId}
                            className={[
                              "flex flex-wrap items-baseline gap-x-2 py-1 text-sm",
                              included ? "text-gray-900" : "text-gray-400",
                            ].join(" ")}
                          >
                            <span className="font-semibold">{passenger.name}</span>
                            <span
                              className={
                                included ? "font-semibold text-emerald-800" : "font-semibold"
                              }
                            >
                              {formatPaisa(passenger.farePaisa)}
                            </span>
                            {passenger.seatsRequested > 1 ? (
                              <span className="text-xs text-gray-500">
                                {passenger.seatsRequested} seats
                              </span>
                            ) : null}
                            {included ? null : (
                              <span className="text-xs text-gray-400">Next car</span>
                            )}
                          </li>
                        );
                      })}
                    </ul>

                    <button
                      type="button"
                      disabled={!canAccept || acceptingKey === stack.key}
                      onClick={() => void acceptStack(stack)}
                      className="btn-primary mt-3 w-full py-2.5 text-sm font-semibold"
                    >
                      {acceptingKey === stack.key
                        ? "Accepting…"
                        : !canAccept
                          ? rides.length > 0
                            ? "Finish current ride first"
                            : "Going offline after this ride"
                          : stack.acceptCount > 1
                            ? "Accept pool"
                            : "Accept"}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      ) : null}
    </main>
  );
}
