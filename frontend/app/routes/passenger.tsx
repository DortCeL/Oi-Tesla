import { useEffect, useState } from "react";
import { Link, redirect, useLoaderData, useNavigate } from "react-router";
import type { Route } from "./+types/passenger";
import { apiUrl } from "../lib/api";
import { clearAuth, getAuth } from "../lib/auth.client";
import { authFetch, authJson } from "../lib/fetch.client";
import { formatPaisa, formatRideType } from "../lib/format";
import type {
  FareEstimate,
  RideRequest,
  RideSummary,
  RideType,
  Zone,
} from "../lib/types";

type RideLive = {
  request: RideRequest;
  ride: RideSummary | null;
  driver: { name: string } | null;
};

export function meta({}: Route.MetaArgs) {
  return [{ title: "Passenger · Oi Tesla" }];
}

const openStatuses = new Set(["REQUESTED", "MATCHED", "IN_PROGRESS"]);

function describeRide(request: RideRequest, live: RideLive | null): string {
  if (request.status === "CANCELLED") return "This request was cancelled.";
  if (request.status === "COMPLETED" || live?.ride?.completedAt) return "Trip completed.";
  if (request.status === "IN_PROGRESS" || live?.ride?.startedAt) return "You are on the way.";
  if (live?.ride?.arrivedAt) return "Your driver has arrived at pickup.";
  if (live?.ride?.status === "WAITING") {
    return `Waiting for the pool to fill (${live.ride.seatsTaken}/${live.ride.capacity}).`;
  }
  if (request.status === "MATCHED" || live?.driver) return "Your driver is on the way to pickup.";
  return "Waiting for a driver. This updates every few seconds.";
}

function canCancel(request: RideRequest, live: RideLive | null): boolean {
  if (request.status === "COMPLETED" || request.status === "CANCELLED") return false;
  if (request.status === "IN_PROGRESS" || live?.ride?.startedAt) return false;
  if (live?.ride?.status === "MATCHED" || live?.ride?.arrivedAt) return false;
  return true;
}

export async function clientLoader() {
  const auth = getAuth();
  if (!auth || auth.role !== "PASSENGER") {
    throw redirect("/login");
  }

  const zonesRes = await fetch(apiUrl("/zones"));
  const zonesData = (await zonesRes.json()) as { zones: Zone[] };

  let active: RideRequest | null = null;
  try {
    const mine = await authJson<{ requests: RideRequest[] }>("/ride-requests/mine");
    active = mine.requests.find((r) => openStatuses.has(r.status)) ?? null;
  } catch (err) {
    if (err instanceof Response) throw err;
  }

  return { name: auth.name, zones: zonesData.zones, active };
}

export default function PassengerHome() {
  const { name, zones, active } = useLoaderData<typeof clientLoader>();
  const navigate = useNavigate();

  const [pickupZoneId, setPickupZoneId] = useState("");
  const [destinationZoneId, setDestinationZoneId] = useState("");
  const [type, setType] = useState<RideType>("SHARED");
  const [seatsRequested, setSeatsRequested] = useState<1 | 2>(1);
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "TESLAPAY">("CASH");
  const [fare, setFare] = useState<FareEstimate | null>(null);
  const [estimateError, setEstimateError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [booked, setBooked] = useState<RideRequest | null>(active);
  const [live, setLive] = useState<RideLive | null>(null);

  const tripReady =
    Boolean(pickupZoneId) &&
    Boolean(destinationZoneId) &&
    pickupZoneId !== destinationZoneId;

  useEffect(() => {
    if (!booked || booked.status === "COMPLETED" || booked.status === "CANCELLED") {
      return;
    }

    let cancelled = false;

    async function poll() {
      try {
        const result = await authJson<RideLive>(`/ride-requests/${booked!.id}`);
        if (cancelled) return;
        setLive(result);
        setBooked(result.request);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof Response && err.status === 401) {
          void navigate("/login");
        }
      }
    }

    void poll();
    const id = window.setInterval(() => void poll(), 3000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [booked?.id, booked?.status, navigate]);

  useEffect(() => {
    if (destinationZoneId && destinationZoneId === pickupZoneId) {
      setDestinationZoneId("");
    }
  }, [pickupZoneId, destinationZoneId]);

  useEffect(() => {
    if (!tripReady) {
      setFare(null);
      setEstimateError(null);
      return;
    }

    const pickup = Number(pickupZoneId);
    const destination = Number(destinationZoneId);
    let cancelled = false;

    async function loadEstimate() {
      setEstimateError(null);
      try {
        const res = await authFetch("/ride-requests/estimate", {
          method: "POST",
          body: JSON.stringify({
            pickupZoneId: pickup,
            destinationZoneId: destination,
            type,
            seatsRequested,
          }),
        });
        if (!res.ok) {
          const err = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(err?.error ?? "Could not estimate fare");
        }
        if (!cancelled) {
          setFare((await res.json()) as FareEstimate);
        }
      } catch (err) {
        if (!cancelled) {
          setFare(null);
          setEstimateError(err instanceof Error ? err.message : "Estimate failed");
        }
      }
    }

    void loadEstimate();
    return () => {
      cancelled = true;
    };
  }, [tripReady, pickupZoneId, destinationZoneId, type, seatsRequested]);

  function logout() {
    clearAuth();
    void navigate("/login");
  }

  async function handleBook(e: React.FormEvent) {
    e.preventDefault();
    if (!tripReady) return;

    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await authFetch("/ride-requests", {
        method: "POST",
        body: JSON.stringify({
          pickupZoneId: Number(pickupZoneId),
          destinationZoneId: Number(destinationZoneId),
          type,
          seatsRequested,
          paymentMethod,
        }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(err?.error ?? "Booking failed");
      }
      const { request } = (await res.json()) as { request: RideRequest };
      setBooked(request);
      setLive(null);
    } catch (err) {
      if (err instanceof Response && err.status === 401) {
        void navigate("/login");
        return;
      }
      setSubmitError(err instanceof Error ? err.message : "Booking failed");
    } finally {
      setSubmitting(false);
    }
  }

  async function cancelBooked() {
    if (!booked) return;
    setSubmitError(null);
    try {
      const res = await authFetch(`/ride-requests/${booked.id}/cancel`, {
        method: "POST",
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(err?.error ?? "Cancel failed");
      }
      setBooked(null);
      setLive(null);
    } catch (err) {
      if (err instanceof Response && err.status === 401) {
        void navigate("/login");
        return;
      }
      setSubmitError(err instanceof Error ? err.message : "Cancel failed");
    }
  }

  return (
    <main className="mx-auto max-w-lg p-6 pt-16">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Hi, {name}</h1>
        <div className="flex items-center gap-3">
          <Link to="/map" className="text-sm text-blue-600">
            Route map
          </Link>
          <button type="button" onClick={logout} className="text-sm text-blue-600">
            Logout
          </button>
        </div>
      </div>

      {booked ? (
        <section className="mt-6 space-y-3 rounded border p-4">
          <p className="font-semibold">Your ride</p>
          <p>
            {booked.pickupZone.name} → {booked.destinationZone.name}
          </p>
          <p className="text-sm text-gray-600">
            {formatRideType(booked.type)} · {booked.seatsRequested} seat
            {booked.seatsRequested === 1 ? "" : "s"} · {formatPaisa(booked.farePaisa)}
          </p>
          <p className="text-sm font-medium text-gray-800">{describeRide(booked, live)}</p>
          {live?.driver ? (
            <p className="text-sm text-gray-600">Driver: {live.driver.name}</p>
          ) : null}
          {canCancel(booked, live) ? (
            <button
              type="button"
              onClick={() => void cancelBooked()}
              className="text-sm text-red-600"
            >
              Cancel request
            </button>
          ) : null}
          {booked.status === "COMPLETED" || booked.status === "CANCELLED" ? (
            <button
              type="button"
              onClick={() => {
                setBooked(null);
                setLive(null);
              }}
              className="w-full rounded border py-2"
            >
              Book another ride
            </button>
          ) : null}
          {submitError ? <p className="text-sm text-red-600">{submitError}</p> : null}
        </section>
      ) : (
        <form onSubmit={handleBook} className="mt-6 space-y-4">
          <label className="block text-sm">
            Pickup
            <select
              required
              value={pickupZoneId}
              onChange={(e) => setPickupZoneId(e.target.value)}
              className="mt-1 w-full rounded border px-3 py-2"
            >
              <option value="">Choose pickup zone</option>
              {zones.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm">
            Destination
            <select
              required
              value={destinationZoneId}
              onChange={(e) => setDestinationZoneId(e.target.value)}
              className="mt-1 w-full rounded border px-3 py-2"
            >
              <option value="">Choose destination</option>
              {zones
                .filter((z) => String(z.id) !== pickupZoneId)
                .map((z) => (
                  <option key={z.id} value={z.id}>
                    {z.name}
                  </option>
                ))}
            </select>
          </label>

          <div className="flex gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="type"
                checked={type === "SHARED"}
                onChange={() => setType("SHARED")}
              />
              Shared
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="type"
                checked={type === "SOLO"}
                onChange={() => {
                  setType("SOLO");
                  setSeatsRequested(1);
                }}
              />
              Fully reserved
            </label>
          </div>

          <div className="flex gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="seats"
                checked={seatsRequested === 1}
                onChange={() => setSeatsRequested(1)}
              />
              1 seat
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="seats"
                checked={seatsRequested === 2}
                disabled={type === "SOLO"}
                onChange={() => setSeatsRequested(2)}
              />
              2 seats
            </label>
          </div>

          <div className="flex gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="pay"
                checked={paymentMethod === "CASH"}
                onChange={() => setPaymentMethod("CASH")}
              />
              Cash
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="pay"
                checked={paymentMethod === "TESLAPAY"}
                onChange={() => setPaymentMethod("TESLAPAY")}
              />
              TeslaPay
            </label>
          </div>

          {fare ? (
            <p className="text-sm text-gray-700">
              Fare: <strong>{formatPaisa(fare.farePaisa)}</strong>
              {fare.poolDiscountPaisa > 0
                ? ` (pool discount ${formatPaisa(fare.poolDiscountPaisa)})`
                : ""}
            </p>
          ) : null}
          {estimateError ? <p className="text-sm text-red-600">{estimateError}</p> : null}
          {submitError ? <p className="text-sm text-red-600">{submitError}</p> : null}

          <button
            type="submit"
            disabled={!tripReady || submitting}
            className="w-full rounded bg-gray-900 py-2 text-white disabled:opacity-50"
          >
            {submitting ? "Booking…" : "Book ride"}
          </button>
        </form>
      )}
    </main>
  );
}
