import { useEffect, useState } from "react";
import { redirect, useLoaderData, useNavigate } from "react-router";
import type { Route } from "./+types/passenger";
import { ChoiceTabs } from "../components/ChoiceTabs";
import { passengerNav } from "../components/TopNav";
import { ZoneSelect } from "../components/ZoneSelect";
import { apiUrl } from "../lib/api";
import { getAuth } from "../lib/auth.client";
import { authFetch, authJson } from "../lib/fetch.client";
import { formatPaisa } from "../lib/format";
import type { FareEstimate, PoolGender, RideRequest, RideType, Zone } from "../lib/types";

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

  const me = await authJson<{ user: { gender: "MALE" | "FEMALE" } }>(
    "/auth/passenger/me",
  );

  return { name: auth.name, zones: zonesData.zones, gender: me.user.gender };
}

export default function PassengerHome() {
  const { name, zones, gender } = useLoaderData<typeof clientLoader>();
  const navigate = useNavigate();

  const [pickupZoneId, setPickupZoneId] = useState("");
  const [destinationZoneId, setDestinationZoneId] = useState("");
  const [type, setType] = useState<RideType>("SHARED");
  const [poolGender, setPoolGender] = useState<PoolGender>("ANY");
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

  function chooseType(next: RideType) {
    setType(next);
    if (next === "SOLO") setSeatsRequested(1);
  }

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
          ...(type === "SHARED" ? { poolGender } : {}),
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
            onChange={(next) => chooseType(next as RideType)}
            options={[
              { value: "SOLO", label: "Fully Reserved" },
              { value: "SHARED", label: "Shared" },
            ]}
          />

          <ChoiceTabs
            label="Share with"
            value={poolGender}
            onChange={(next) => setPoolGender(next as PoolGender)}
            disabled={type === "SOLO"}
            options={[
              { value: "ANY", label: "Anyone" },
              gender === "FEMALE"
                ? { value: "FEMALE_ONLY", label: "Women only" }
                : { value: "MALE_ONLY", label: "Men only" },
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
            <div>
              <p className="mb-1.5 text-xs font-medium text-gray-600">Fare preview</p>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    {
                      value: "SOLO" as const,
                      label: "Fully Reserved",
                      fare: soloFare.farePaisa,
                      note: "The whole Tesla",
                    },
                    {
                      value: "SHARED" as const,
                      label: "Shared",
                      fare: sharedFare.farePaisa,
                      note:
                        sharedFare.poolDiscountPaisa > 0
                          ? `${formatPaisa(sharedFare.poolDiscountPaisa)} off`
                          : "Split the ride",
                    },
                  ] as const
                ).map((option) => {
                  const selected = type === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => chooseType(option.value)}
                      className={[
                        "rounded-xl px-3 py-3 text-left ring-1 transition",
                        selected
                          ? "bg-emerald-50 ring-emerald-600"
                          : "bg-white ring-gray-200 hover:ring-emerald-300",
                      ].join(" ")}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium text-gray-600">{option.label}</span>
                        {selected ? (
                          <span className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
                            Selected
                          </span>
                        ) : null}
                      </span>
                      <span className="mt-1 block text-2xl font-bold text-gray-900">
                        {formatPaisa(option.fare)}
                      </span>
                      <span className="mt-0.5 block text-xs text-gray-500">{option.note}</span>
                    </button>
                  );
                })}
              </div>
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
