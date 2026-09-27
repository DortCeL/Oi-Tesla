import { useEffect, useState } from "react";
import { Link, redirect, useLoaderData, useNavigate } from "react-router";
import type { Route } from "./+types/passenger.searching.$requestId";
import { clearAuth, getAuth } from "../lib/auth.client";
import { authFetch, authJson } from "../lib/fetch.client";
import { formatPaisa, formatRideType } from "../lib/format";
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

  function logout() {
    clearAuth();
    void navigate("/login");
  }

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

      <section className="mt-6 rounded border p-6 text-center">
        <div className="mb-6 flex justify-center gap-2">
          {[0, 1, 2].map((dot) => (
            <span
              key={dot}
              className="inline-block h-3 w-3 animate-bounce rounded-full bg-gray-900"
              style={{ animationDelay: `${dot * 0.15}s` }}
            />
          ))}
        </div>
        <h2 className="text-xl font-bold">Waiting for a driver</h2>
        <p className="mt-2 text-sm text-gray-600">
          Nearby drivers can see your request and accept it.
        </p>

        {data ? (
          <div className="mt-6 rounded border bg-gray-50 p-4 text-left text-sm">
            <p>
              {data.request.pickupZone.name} → {data.request.destinationZone.name}
            </p>
            <p className="mt-1 text-gray-600">
              {formatRideType(data.request.type)} · {data.request.seatsRequested} seat
              {data.request.seatsRequested === 1 ? "" : "s"} · {formatPaisa(data.request.farePaisa)}
            </p>
          </div>
        ) : null}

        {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}

        <button
          type="button"
          onClick={() => void cancelRequest()}
          disabled={cancelling}
          className="mt-6 text-sm text-red-600 disabled:opacity-50"
        >
          {cancelling ? "Cancelling…" : "Cancel request"}
        </button>
      </section>
    </main>
  );
}
