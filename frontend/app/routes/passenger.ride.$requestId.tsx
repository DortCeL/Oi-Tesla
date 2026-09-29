import { useEffect, useState } from "react";
import { redirect, useLoaderData, useNavigate } from "react-router";
import type { Route } from "./+types/passenger.ride.$requestId";
import { DriverLiveBanner } from "../components/DriverLiveBanner";
import { StatusBadge } from "../components/StatusBadge";
import { passengerNav } from "../components/TopNav";
import { getAuth } from "../lib/auth.client";
import { authFetch, authJson } from "../lib/fetch.client";
import { formatGender, formatPaisa, formatPoolGender, formatRideType } from "../lib/format";
import type { PoolMate, RideRequest, RideSummary } from "../lib/types";

type PollResult = {
  request: RideRequest;
  ride: RideSummary | null;
  driver: { name: string } | null;
};

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

  const canCancel =
    data &&
    ["REQUESTED", "MATCHED"].includes(data.request.status) &&
    (!data.ride || data.ride.status === "WAITING");

  const req = data?.request;

  return (
    <main className="page">
      {passengerNav(name)}

      {!data && !error ? <p className="text-sm text-gray-500">Loading ride…</p> : null}
      {error ? <p className="mt-6 text-sm text-red-600">{error}</p> : null}

      {data && req ? (
        <div className="space-y-5">
          {data.ride ? (
            <DriverLiveBanner
              driverName={data.driver?.name ?? null}
              rideStatus={data.ride.status}
              arrivedAt={data.ride.arrivedAt}
              startedAt={data.ride.startedAt}
            />
          ) : null}

          <div className="card">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold">Your trip</h1>
              <StatusBadge status={req.status} />
            </div>
            <p className="mt-2 text-lg font-semibold text-gray-900">
              {req.pickupZone.name} → {req.destinationZone.name}
            </p>
            <p className="mt-1 text-sm text-gray-500">
              {formatRideType(req.type)} · {req.seatsRequested} seat
              {req.seatsRequested === 1 ? "" : "s"}
              {data.ride ? ` · pool ${data.ride.seatsTaken}/${data.ride.capacity}` : ""}
              {req.type === "SHARED" && req.poolGender !== "ANY"
                ? ` · ${formatPoolGender(req.poolGender)}`
                : ""}
            </p>

            <div className="mt-4 rounded-xl bg-emerald-50 p-4 ring-1 ring-emerald-100">
              <p className="text-xs font-bold uppercase tracking-wide text-emerald-800">
                Your fare
              </p>
              <p className="mt-1 text-3xl font-bold text-emerald-950">
                {formatPaisa(req.farePaisa)}
              </p>
              <p className="mt-1 text-sm text-emerald-900/80">
                Pay by {req.paymentMethod === "TESLAPAY" ? "TeslaPay" : "cash"}
              </p>
              <dl className="mt-3 space-y-1 border-t border-emerald-200/70 pt-3 text-sm text-emerald-950/80">
                <div className="flex justify-between gap-3">
                  <dt>Base fare</dt>
                  <dd>{formatPaisa(req.baseFarePaisa)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt>Distance</dt>
                  <dd>{formatPaisa(req.distanceChargePaisa)}</dd>
                </div>
                {req.poolDiscountPaisa > 0 ? (
                  <div className="flex justify-between gap-3 text-emerald-700">
                    <dt>Pool discount</dt>
                    <dd>−{formatPaisa(req.poolDiscountPaisa)}</dd>
                  </div>
                ) : null}
              </dl>
            </div>
          </div>

          {poolMates.length > 0 ? (
            <div className="card">
              <p className="font-semibold text-gray-900">Your pool mates</p>
              <p className="mt-1 text-sm text-gray-500">People sharing this Tesla with you</p>
              <ul className="mt-4 space-y-3">
                {poolMates.map((mate, index) => (
                  <li
                    key={`${mate.name}-${index}`}
                    className="rounded-xl bg-gray-50 p-4 ring-1 ring-gray-100"
                  >
                    <p className="text-lg font-semibold text-gray-900">{mate.name}</p>
                    <p className="text-sm text-gray-500">{formatGender(mate.gender)}</p>
                    <p className="mt-2 text-sm font-medium text-gray-800">
                      Going to {mate.destinationZone.name}
                    </p>
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
              className="btn-secondary w-full text-red-600"
            >
              {cancelling ? "Cancelling…" : "Cancel ride"}
            </button>
          ) : null}
        </div>
      ) : null}
    </main>
  );
}
