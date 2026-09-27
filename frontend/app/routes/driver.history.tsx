import { Link, redirect, useLoaderData, useNavigate } from "react-router";
import type { Route } from "./+types/driver.history";
import { clearAuth, getAuth } from "../lib/auth.client";
import { authJson } from "../lib/fetch.client";
import { formatPaisa, formatRideType } from "../lib/format";
import type { DriverRide } from "../lib/types";

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
  if (!auth || auth.role !== "DRIVER") {
    throw redirect("/login");
  }

  let rides: DriverRide[] = [];
  try {
    const data = await authJson<{ rides: DriverRide[] }>("/driver/rides/history");
    rides = data.rides;
  } catch (err) {
    if (err instanceof Response) throw err;
  }

  return { name: auth.name, rides };
}

export default function DriverHistory() {
  const { name, rides } = useLoaderData<typeof clientLoader>();
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
          <Link to="/driver" className="text-sm text-blue-600">
            Rides
          </Link>
          <Link to="/driver/profile" className="text-sm text-blue-600">
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

      {rides.length === 0 ? (
        <p className="mt-4 rounded border p-4 text-sm text-gray-600">
          No completed or cancelled rides yet.
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {rides.map((ride) => (
            <li key={ride.id} className="rounded border p-4 text-sm">
              <div className="flex items-start justify-between gap-3">
                <p className="font-semibold">Pickup · {ride.pickupZone.name}</p>
                <p className="shrink-0 text-gray-600">{formatStatus(ride.status)}</p>
              </div>
              <p className="mt-1 text-gray-600">
                {formatRideType(ride.type)} · {ride.seatsTaken}/{ride.capacity} seats · earned{" "}
                {formatPaisa(ride.totalFarePaisa)}
              </p>
              <p className="mt-1 text-gray-500">{new Date(ride.createdAt).toLocaleString()}</p>
              {ride.passengers.length > 0 ? (
                <ul className="mt-3 space-y-1 border-t pt-3">
                  {ride.passengers.map((passenger, index) => (
                    <li key={`${passenger.name}-${index}`} className="flex justify-between gap-3">
                      <span>{passenger.name}</span>
                      <span>{formatPaisa(passenger.farePaisa)}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
