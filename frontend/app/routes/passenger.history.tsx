import { redirect, useLoaderData } from "react-router";
import type { Route } from "./+types/passenger.history";
import { StatusBadge } from "../components/StatusBadge";
import { passengerNav } from "../components/TopNav";
import { getAuth } from "../lib/auth.client";
import { authJson } from "../lib/fetch.client";
import { formatPaisa, formatRideType } from "../lib/format";
import type { RideRequest } from "../lib/types";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Ride history · Oi Tesla" }];
}

export async function clientLoader() {
  const auth = getAuth();
  if (!auth || auth.role !== "PASSENGER") {
    throw redirect("/login");
  }

  let requests: RideRequest[] = [];
  try {
    const data = await authJson<{ requests: RideRequest[] }>("/ride-requests/history");
    requests = data.requests;
  } catch (err) {
    if (err instanceof Response) throw err;
  }

  return { name: auth.name, requests };
}

export default function PassengerHistory() {
  const { name, requests } = useLoaderData<typeof clientLoader>();

  return (
    <main className="page">
      {passengerNav(name)}

      <h1 className="mb-4 text-2xl font-bold">Ride history</h1>

      {requests.length === 0 ? (
        <div className="card text-center text-gray-500">
          No past rides yet. Book one from the Book tab.
        </div>
      ) : (
        <ul className="space-y-3">
          {requests.map((req) => (
            <li key={req.id} className="card">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-gray-900">
                    {req.pickupZone.name} → {req.destinationZone.name}
                  </p>
                  <p className="mt-1 text-sm text-gray-500">
                    {formatRideType(req.type)} · {req.seatsRequested} seat
                    {req.seatsRequested === 1 ? "" : "s"} · {formatPaisa(req.farePaisa)}
                  </p>
                  <p className="mt-1 text-xs text-gray-400">
                    {new Date(req.createdAt).toLocaleString()}
                  </p>
                </div>
                <StatusBadge status={req.status} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
