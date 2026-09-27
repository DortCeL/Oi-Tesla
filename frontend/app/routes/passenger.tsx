import { useEffect, useState } from "react";
import { redirect, useLoaderData, useNavigate } from "react-router";
import type { Route } from "./+types/passenger";
import { passengerNav } from "../components/TopNav";
import { apiUrl } from "../lib/api";
import { getAuth } from "../lib/auth.client";
import { authFetch, authJson } from "../lib/fetch.client";
import { formatPaisa } from "../lib/format";
import type { FareEstimate, RideRequest, RideType, Zone } from "../lib/types";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Passenger · Oi Tesla" }];
}

export async function clientLoader() {
  const auth = getAuth();
  if (!auth || auth.role !== "PASSENGER") {
    throw redirect("/login");
  }

  const zonesRes = await fetch(apiUrl("/zones"));
  const zonesData = (await zonesRes.json()) as { zones: Zone[] };

  try {
    const mine = await authJson<{ requests: RideRequest[] }>("/ride-requests/mine");
    const active = mine.requests[0];
    if (active) {
      if (active.status === "REQUESTED" && !active.rideId) {
        throw redirect(`/passenger/searching/${active.id}`);
      }
      throw redirect(`/passenger/ride/${active.id}`);
    }
  } catch (err) {
    if (err instanceof Response) throw err;
  }

  return { name: auth.name, zones: zonesData.zones };
}

export default function PassengerHome() {
  const { name, zones } = useLoaderData<typeof clientLoader>();
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

  const tripReady =
    Boolean(pickupZoneId) &&
    Boolean(destinationZoneId) &&
    pickupZoneId !== destinationZoneId;

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
      if (request.status === "REQUESTED" && !request.rideId) {
        void navigate(`/passenger/searching/${request.id}`);
      } else {
        void navigate(`/passenger/ride/${request.id}`);
      }
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

  return (
    <main className="page">
      {passengerNav(name)}

      <form onSubmit={handleBook} className="card space-y-4">
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
          className="btn-primary w-full disabled:opacity-50"
        >
          {submitting ? "Booking…" : "Book ride"}
        </button>
      </form>
    </main>
  );
}
