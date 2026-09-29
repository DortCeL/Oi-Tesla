import { useEffect, useState } from "react";
import { redirect, useLoaderData, useNavigate } from "react-router";
import type { Route } from "./+types/passenger.searching.$requestId";
import { passengerNav } from "../components/TopNav";
import { getAuth } from "../lib/auth.client";
import { authFetch, authJson } from "../lib/fetch.client";
import { formatPaisa, formatPoolGender, formatRideType } from "../lib/format";
import type { RideRequest, RideSummary } from "../lib/types";

type PollResult = {
  request: RideRequest;
  ride: RideSummary | null;
  driver: { name: string } | null;
};

export function meta({}: Route.MetaArgs) {
  return [{ title: "Searching · Oi Tesla" }];
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

export default function PassengerSearching() {
  const { name, requestId } = useLoaderData<typeof clientLoader>();
  const navigate = useNavigate();
  const [data, setData] = useState<PollResult | null>(null);
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

        if (result.request.status === "CANCELLED") {
          void navigate("/passenger", { replace: true });
          return;
        }
        if (result.request.status !== "REQUESTED" || result.request.rideId) {
          void navigate(`/passenger/ride/${requestId}`, { replace: true });
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
        setError(err instanceof Error ? err.message : "Could not load request");
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

  const req = data?.request;

  return (
    <main className="page">
      {passengerNav(name)}

      <div className="space-y-5">
        <div className="live-banner live-banner-enroute">
          <div className="live-banner-orbit" aria-hidden>
            <span className="live-banner-orbit-dot" />
          </div>
          <p className="live-banner-kicker">Searching</p>
          <p className="live-banner-title">Looking for a driver</p>
          <p className="live-banner-sub">
            Drivers in your pickup zone can see this request and accept it.
          </p>
        </div>

        {req ? (
          <section className="card text-left">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Your request
            </p>
            <p className="mt-2 text-2xl font-bold tracking-tight text-gray-900">
              {req.pickupZone.name} → {req.destinationZone.name}
            </p>
            <p className="mt-1 text-sm text-gray-500">
              {formatRideType(req.type)} · {req.seatsRequested} seat
              {req.seatsRequested === 1 ? "" : "s"}
              {req.type === "SHARED" ? ` · ${formatPoolGender(req.poolGender)}` : ""}
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
            </div>
          </section>
        ) : (
          <section className="card text-sm text-gray-500">Loading your request…</section>
        )}

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <button
          type="button"
          onClick={() => void cancelRequest()}
          disabled={cancelling}
          className="btn-secondary w-full text-red-600"
        >
          {cancelling ? "Cancelling…" : "Cancel request"}
        </button>
      </div>
    </main>
  );
}
