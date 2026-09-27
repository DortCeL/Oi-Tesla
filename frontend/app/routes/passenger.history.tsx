import { Link, redirect, useLoaderData, useNavigate } from "react-router";
import type { Route } from "./+types/passenger.history";
import { clearAuth, getAuth } from "../lib/auth.client";
import { authJson } from "../lib/fetch.client";
import { formatPaisa, formatRideType } from "../lib/format";
import type { RideRequest } from "../lib/types";

function formatStatus(status: string): string {
  if (status === "COMPLETED") return "Completed";
  if (status === "CANCELLED") return "Cancelled";
  return status;
}

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
  const navigate = useNavigate();

  function logout() {
    clearAuth();
    void navigate("/login");
  }

  return (
    <main className="mx-auto max-w-lg p-6 pt-16">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Hi, {name}</h1>
        <div className="flex items-center gap-3">
          <Link to="/passenger" className="text-sm text-blue-600">
            Book
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

      <h2 className="mt-6 text-xl font-bold">Ride history</h2>

      {requests.length === 0 ? (
        <p className="mt-4 rounded border p-4 text-sm text-gray-600">
          No past rides yet. Book one from the booking page.
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {requests.map((req) => (
            <li key={req.id} className="rounded border p-4 text-sm">
              <div className="flex items-start justify-between gap-3">
                <p className="font-semibold">
                  {req.pickupZone.name} → {req.destinationZone.name}
                </p>
                <p className="shrink-0 text-gray-600">{formatStatus(req.status)}</p>
              </div>
              <p className="mt-1 text-gray-600">
                {formatRideType(req.type)} · {req.seatsRequested} seat
                {req.seatsRequested === 1 ? "" : "s"} · {formatPaisa(req.farePaisa)}
              </p>
              <p className="mt-1 text-gray-500">{new Date(req.createdAt).toLocaleString()}</p>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
