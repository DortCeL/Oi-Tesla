import { Link } from "react-router";
import type { Route } from "./+types/map";
import { StaticRouteMap } from "../components/StaticRouteMap";
import { getAuth } from "../lib/auth.client";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Route map · Oi Tesla" }];
}

export async function clientLoader() {
  return { auth: getAuth() };
}

export default function MapPage({ loaderData }: Route.ComponentProps) {
  const { auth } = loaderData;
  const backTo =
    auth?.role === "PASSENGER" ? "/passenger" : auth?.role === "DRIVER" ? "/driver" : "/";

  return (
    <main className="mx-auto max-w-lg p-6 pt-16">
      <div className="flex items-center justify-between">
        <Link to={backTo} className="text-sm text-blue-600">
          Back
        </Link>
        {auth ? null : (
          <Link to="/login" className="text-sm text-blue-600">
            Sign in
          </Link>
        )}
      </div>

      <h1 className="mt-4 text-2xl font-bold">Zone roadmap</h1>
      <p className="mt-1 text-sm text-gray-600">
        How the zones connect. This diagram does not move with a trip.
      </p>
      <div className="mt-6">
        <StaticRouteMap />
      </div>
    </main>
  );
}
