import { useEffect, useState } from "react";
import { redirect, useLoaderData, useNavigate } from "react-router";
import type { Route } from "./+types/passenger";
import { ChoiceTabs } from "../components/ChoiceTabs";
import { passengerNav } from "../components/TopNav";
import { ZoneSelect } from "../components/ZoneSelect";
import { apiUrl } from "../lib/api";
import { getAuth } from "../lib/auth.client";
import { authFetch, authJson } from "../lib/fetch.client";
import { formatPaisa, formatRideType } from "../lib/format";
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
  const [soloFare, setSoloFare] = useState<FareEstimate | null>(null);
  const [sharedFare, setSharedFare] = useState<FareEstimate | null>(null);
  const [estimateError, setEstimateError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const zoneOptions = zones.map((zone) => ({
    value: String(zone.id),
    label: zone.name,
  }));

  const destinationOptions = zones
    .filter((zone) => String(zone.id) !== pickupZoneId)
    .map((zone) => ({ value: String(zone.id), label: zone.name }));

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
      setSoloFare(null);
      setSharedFare(null);
      setEstimateError(null);
      return;
    }

    const pickup = Number(pickupZoneId);
    const destination = Number(destinationZoneId);
    let cancelled = false;

    async function loadEstimates() {
      setEstimateError(null);
      try {
        const base = {
          pickupZoneId: pickup,
          destinationZoneId: destination,
          seatsRequested,
        };
        const [soloRes, sharedRes] = await Promise.all([
          authFetch("/ride-requests/estimate", {
            method: "POST",
            body: JSON.stringify({ ...base, type: "SOLO" }),
          }),
          authFetch("/ride-requests/estimate", {
            method: "POST",
            body: JSON.stringify({ ...base, type: "SHARED" }),
          }),
        ]);

        if (!soloRes.ok || !sharedRes.ok) {
          const err = (await soloRes.json().catch(() => null)) as { error?: string } | null;
          throw new Error(err?.error ?? "Could not estimate fare");
        }

        if (!cancelled) {
          setSoloFare((await soloRes.json()) as FareEstimate);
          setSharedFare((await sharedRes.json()) as FareEstimate);
        }
      } catch (err) {
        if (!cancelled) {
          setSoloFare(null);
          setSharedFare(null);
          setEstimateError(err instanceof Error ? err.message : "Estimate failed");
        }
      }
    }

    void loadEstimates();
    return () => {
      cancelled = true;
    };
  }, [tripReady, pickupZoneId, destinationZoneId, seatsRequested]);

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

      <section className="card">
        <h2 className="text-2xl font-bold">Book a ride</h2>

        <form onSubmit={handleBook} className="mt-5 space-y-5">
          <ZoneSelect
            label="Pickup zone"
            value={pickupZoneId}
            onChange={setPickupZoneId}
            options={zoneOptions}
            placeholder="Choose pickup zone"
          />

          <ZoneSelect
            label="Destination"
            value={destinationZoneId}
            onChange={setDestinationZoneId}
            options={destinationOptions.length > 0 ? destinationOptions : zoneOptions}
            placeholder="Choose destination"
          />

          <ChoiceTabs
            label="Ride type"
            value={type}
            onChange={(next) => {
              setType(next as RideType);
              if (next === "SOLO") setSeatsRequested(1);
            }}
            options={[
              { value: "SOLO", label: "Fully Reserved" },
              { value: "SHARED", label: "Shared" },
            ]}
          />

          <ChoiceTabs
            label="Seats"
            value={seatsRequested}
            onChange={(next) => setSeatsRequested(next as 1 | 2)}
            disabled={type === "SOLO"}
            options={[
              { value: 1, label: "1 seat" },
              { value: 2, label: "2 seats" },
            ]}
          />

          <ChoiceTabs
            label="Payment"
            value={paymentMethod}
            onChange={(next) => setPaymentMethod(next as "CASH" | "TESLAPAY")}
            options={[
              { value: "CASH", label: "Cash" },
              { value: "TESLAPAY", label: "TeslaPay" },
            ]}
          />

          {tripReady && soloFare && sharedFare ? (
            <div className="rounded-xl bg-emerald-50 p-4 text-sm ring-1 ring-emerald-100">
              <p className="font-medium">Fare preview</p>
              <p className="mt-1">Fully Reserved: {formatPaisa(soloFare.farePaisa)}</p>
              <p>
                Shared: {formatPaisa(sharedFare.farePaisa)}
                {sharedFare.poolDiscountPaisa > 0
                  ? ` (−${formatPaisa(sharedFare.poolDiscountPaisa)} pool discount)`
                  : ""}
              </p>
              <p className="mt-2 text-gray-600">
                Your selection ({formatRideType(type)}):{" "}
                <strong>
                  {formatPaisa(type === "SOLO" ? soloFare.farePaisa : sharedFare.farePaisa)}
                </strong>
              </p>
            </div>
          ) : null}

          {estimateError ? <p className="text-sm text-red-600">{estimateError}</p> : null}
          {submitError ? <p className="text-sm text-red-600">{submitError}</p> : null}

          <button
            type="submit"
            disabled={!tripReady || submitting}
            className="btn-primary w-full py-3 text-base font-semibold"
          >
            {submitting ? "Booking…" : "Book ride"}
          </button>
        </form>
      </section>
    </main>
  );
}
