import { Link } from "react-router";
import type { Route } from "./+types/map";
import { StaticRouteMap } from "../components/StaticRouteMap";
import { driverNav, passengerNav } from "../components/TopNav";
import { getAuth } from "../lib/auth.client";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Route map · Oi Tesla" }];
}

export async function clientLoader() {
  return { auth: getAuth() };
}

export default function MapPage({ loaderData }: Route.ComponentProps) {
  const { auth } = loaderData;

  return (
    <main className="page">
      {auth?.role === "PASSENGER"
        ? passengerNav(auth.name)
        : auth?.role === "DRIVER"
          ? driverNav(auth.name)
          : (
              <header className="mb-6 flex items-center justify-between">
                <Link to="/" className="text-lg font-semibold text-gray-900">
                  Oi Tesla
                </Link>
                <Link to="/login" className="text-sm text-emerald-700 hover:underline">
                  Sign in
                </Link>
              </header>
            )}

      <section className="card">
        <h1 className="text-xl font-bold text-gray-900">Zone roadmap</h1>
        <p className="mt-1 text-sm text-gray-600">
          Static diagram of how zones connect. No live trip or distance overlay.
        </p>
        <div className="mt-6">
          <StaticRouteMap />
        </div>
      </section>
    </main>
  );
}
