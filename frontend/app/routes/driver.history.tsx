import { redirect, useLoaderData } from "react-router";
import type { Route } from "./+types/driver.history";
import { PassengerList } from "../components/PassengerList";
import { StatusBadge } from "../components/StatusBadge";
import { driverNav } from "../components/TopNav";
import { getAuth } from "../lib/auth.client";
import { authJson } from "../lib/fetch.client";
import { formatPaisa, formatRideType } from "../lib/format";
import type { DriverRide } from "../lib/types";

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

  return (
    <main className="page">
      {driverNav(name)}

      <h1 className="mb-4 text-2xl font-bold">Ride history</h1>

      {rides.length === 0 ? (
        <div className="card text-center text-gray-500">
          No completed or cancelled rides yet.
        </div>
      ) : (
        <ul className="space-y-3">
          {rides.map((ride) => (
            <li key={ride.id} className="card">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-gray-900">
                    Pickup · {ride.pickupZone.name}
                  </p>
                  <p className="mt-1 text-sm text-gray-500">
                    {formatRideType(ride.type)} · {ride.seatsTaken}/{ride.capacity} seats
                    {ride.totalFarePaisa != null
                      ? ` · earned ${formatPaisa(ride.totalFarePaisa)}`
                      : ""}
                  </p>
                  <p className="mt-1 text-xs text-gray-400">
                    {new Date(ride.createdAt).toLocaleString()}
                  </p>
                </div>
                <StatusBadge status={ride.status} />
              </div>
              {(ride.passengers?.length ?? 0) > 0 || (ride.totalFarePaisa ?? 0) > 0 ? (
                <div className="mt-3 space-y-3 border-t border-gray-100 pt-3">
                  {(ride.totalFarePaisa ?? 0) > 0 ? (
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-gray-700">Your earnings</p>
                      <p className="text-lg font-bold text-emerald-900">
                        {formatPaisa(ride.totalFarePaisa ?? 0)}
                      </p>
                    </div>
                  ) : null}
                  <PassengerList passengers={ride.passengers ?? []} />
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
