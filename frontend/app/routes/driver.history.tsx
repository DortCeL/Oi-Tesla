import { redirect, useLoaderData } from "react-router";
import type { Route } from "./+types/driver.history";
import { driverNav } from "../components/TopNav";
import { getAuth } from "../lib/auth.client";
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
            <li key={ride.id} className="card text-sm">
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
