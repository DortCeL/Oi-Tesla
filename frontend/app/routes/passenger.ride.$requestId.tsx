import { useEffect, useState } from "react";
import { Link, redirect, useLoaderData, useNavigate } from "react-router";
import type { Route } from "./+types/passenger.ride.$requestId";
import { clearAuth, getAuth } from "../lib/auth.client";
import { authFetch, authJson } from "../lib/fetch.client";
import { formatGender, formatPaisa, formatRideType } from "../lib/format";
import type { PoolMate, RideRequest, RideSummary } from "../lib/types";

type PollResult = {
  request: RideRequest;
  ride: RideSummary | null;
  driver: { name: string } | null;
};

function describeRide(result: PollResult): string {
  const { request, ride } = result;
  if (request.status === "COMPLETED" || ride?.completedAt) return "Trip completed.";
  if (request.status === "IN_PROGRESS" || ride?.startedAt) return "You are on the way.";
  if (ride?.arrivedAt) return "Your driver has arrived at pickup.";
  if (ride?.status === "WAITING") {
    return `Waiting for the pool to fill (${ride.seatsTaken}/${ride.capacity}).`;
  }
  if (request.status === "MATCHED" || result.driver) return "Your driver is on the way to pickup.";
  return "Waiting for a driver. This updates every few seconds.";
}

export function meta({}: Route.MetaArgs) {
  return [{ title: "Your ride · Oi Tesla" }];
}

export async function clientLoader({ params }: Route.ClientLoaderArgs) {
  const auth = getAuth();
  if (!auth || auth.role !== "PASSENGER") {
    throw redirect("/login");
  }

  try {
    const mine = await authJson<{ requests: RideRequest[] }>("/ride-requests/mine");
    const active = mine.requests[0];
    if (!active || active.id !== params.requestId) {
      throw redirect("/passenger");
    }
  } catch (err) {
    if (err instanceof Response) throw err;
    throw redirect("/passenger");
  }

  return { name: auth.name, requestId: params.requestId };
}

export default function PassengerRide() {
  const { name, requestId } = useLoaderData<typeof clientLoader>();
  const navigate = useNavigate();
  const [data, setData] = useState<PollResult | null>(null);
  const [poolMates, setPoolMates] = useState<PoolMate[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const result = await authJson<PollResult>(`/ride-requests/${requestId}`);
        if (cancelled) return;

        setData(result);
        setError(null);

        if (result.request.status === "CANCELLED" || result.request.status === "COMPLETED") {
          void navigate("/passenger", { replace: true });
          return;
        }
        if (result.request.status === "REQUESTED" && !result.request.rideId) {
          void navigate(`/passenger/searching/${requestId}`, { replace: true });
          return;
        }

        const rideActive =
          result.ride &&
          ["WAITING", "MATCHED", "IN_PROGRESS"].includes(result.ride.status);

        if (rideActive && result.request.type === "SHARED") {
          try {
            const mates = await authJson<{ poolMates: PoolMate[] }>(
              `/ride-requests/${requestId}/pool-mates`,
            );
            if (!cancelled) setPoolMates(mates.poolMates);
          } catch {
            if (!cancelled) setPoolMates([]);
          }
        } else if (!cancelled) {
          setPoolMates([]);
        }
      } catch (err) {
        if (cancelled) return;
        if (err instanceof Response && err.status === 401) {
          void navigate("/login");
          return;
        }
        const message = err instanceof Error ? err.message : "";
        if (message.includes("404") || message.toLowerCase().includes("not found")) {
          void navigate("/passenger", { replace: true });
          return;
        }
        setError(err instanceof Error ? err.message : "Could not load ride");
      }
    }

    void poll();
    const id = window.setInterval(() => void poll(), 3000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [requestId, navigate]);

  async function cancelRequest() {
    setCancelling(true);
    try {
      const res = await authFetch(`/ride-requests/${requestId}/cancel`, { method: "POST" });
      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(err?.error ?? "Cancel failed");
      }
      void navigate("/passenger", { replace: true });
    } catch (err) {
      if (err instanceof Response && err.status === 401) {
        void navigate("/login");
        return;
      }
      setError(err instanceof Error ? err.message : "Cancel failed");
    } finally {
      setCancelling(false);
    }
  }

  function logout() {
    clearAuth();
    void navigate("/login");
  }

  const canCancel =
    data &&
    ["REQUESTED", "MATCHED"].includes(data.request.status) &&
    (!data.ride || data.ride.status === "WAITING");

  const req = data?.request;

  return (
    <main className="mx-auto max-w-lg p-6 pt-16">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Hi, {name}</h1>
        <div className="flex items-center gap-3">
          <Link to="/passenger/history" className="text-sm text-blue-600">
            History
          </Link>
          <Link to="/passenger/profile" className="text-sm text-blue-600">
            Profile
          </Link>
          <Link to="/map" className="text-sm text-blue-600">
            Route map
          </Link>
          <button type="button" onClick={logout} className="text-sm text-blue-600">
            Logout
          </button>
        </div>
      </div>

      {!data && !error ? <p className="mt-6 text-sm text-gray-500">Loading ride…</p> : null}
      {error ? <p className="mt-6 text-sm text-red-600">{error}</p> : null}

      {data && req ? (
        <section className="mt-6 space-y-4 rounded border p-4">
          <p className="font-semibold">Your trip</p>
          <p>
            {req.pickupZone.name} → {req.destinationZone.name}
          </p>
          <p className="text-sm text-gray-600">
            {formatRideType(req.type)} · {req.seatsRequested} seat
            {req.seatsRequested === 1 ? "" : "s"}
            {data.ride ? ` · pool ${data.ride.seatsTaken}/${data.ride.capacity}` : ""}
          </p>
          <p className="text-sm font-medium text-gray-800">{describeRide(data)}</p>
          {data.driver ? (
            <p className="text-sm text-gray-600">Driver: {data.driver.name}</p>
          ) : null}

          <div className="rounded border bg-gray-50 p-4 text-sm">
            <p className="text-gray-500">Your fare</p>
            <p className="text-2xl font-bold">{formatPaisa(req.farePaisa)}</p>
            <p className="mt-1 text-gray-600">
              Pay by {req.paymentMethod === "TESLAPAY" ? "TeslaPay" : "cash"}
            </p>
            <dl className="mt-3 space-y-1 border-t pt-3 text-gray-700">
              <div className="flex justify-between gap-3">
                <dt>Base fare</dt>
                <dd>{formatPaisa(req.baseFarePaisa)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt>Distance</dt>
                <dd>{formatPaisa(req.distanceChargePaisa)}</dd>
              </div>
              {req.poolDiscountPaisa > 0 ? (
                <div className="flex justify-between gap-3">
                  <dt>Pool discount</dt>
                  <dd>−{formatPaisa(req.poolDiscountPaisa)}</dd>
                </div>
              ) : null}
            </dl>
          </div>

          {poolMates.length > 0 ? (
            <div className="space-y-2 border-t pt-3">
              <p className="text-sm font-semibold">Your pool mates</p>
              <ul className="space-y-3">
                {poolMates.map((mate, index) => (
                  <li key={`${mate.name}-${index}`} className="text-sm">
                    <p className="font-medium">{mate.name}</p>
                    <p className="text-gray-600">
                      {formatGender(mate.gender)}
                      {mate.occupation ? ` · ${mate.occupation}` : ""}
                    </p>
                    <p className="text-gray-800">Going to {mate.destinationZone.name}</p>
                    <p className="text-gray-600">
                      {formatRideType(mate.type)} · their fare {formatPaisa(mate.farePaisa)} ·{" "}
                      {mate.paymentMethod === "TESLAPAY" ? "TeslaPay" : "Cash"}
                    </p>
                    {mate.affiliation ? <p className="text-gray-600">{mate.affiliation}</p> : null}
                    {mate.hobbies.length > 0 ? (
                      <p className="text-gray-600">Hobbies: {mate.hobbies.join(", ")}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {canCancel ? (
            <button
              type="button"
              onClick={() => void cancelRequest()}
              disabled={cancelling}
              className="text-sm text-red-600 disabled:opacity-50"
            >
              {cancelling ? "Cancelling…" : "Cancel ride"}
            </button>
          ) : null}
        </section>
      ) : null}
    </main>
  );
}
