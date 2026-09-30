import { Link } from "react-router";
import type { Route } from "./+types/map";
import { PublicPage } from "../components/auth/PublicPage";
import { StaticRouteMap } from "../components/StaticRouteMap";
import { driverNav, passengerNav } from "../components/TopNav";
import { getAuth } from "../lib/auth.client";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Route map · Oi Tesla" }];
}

export async function clientLoader() {
  return { auth: getAuth() };
}

function MapContent() {
  return (
    <section className="map-card">
      <div className="map-card-header">
        <div>
          <p className="map-card-kicker">Network diagram</p>
          <h1 className="map-card-title">Zone roadmap</h1>
          <p className="map-card-desc">
            How pickup and destination zones connect across Dhaka. Fares follow
            these path lengths — not live GPS.
          </p>
        </div>
      </div>

      <div className="map-card-legend">
        <span className="map-legend-item">
          <span className="map-legend-dot map-legend-dot-hub" aria-hidden />
          Hub zone
        </span>
        <span className="map-legend-item">
          <span className="map-legend-dot map-legend-dot-node" aria-hidden />
          Pickup / drop-off
        </span>
      </div>

      <div className="map-card-body">
        <StaticRouteMap />
      </div>
    </section>
  );
}

export default function MapPage({ loaderData }: Route.ComponentProps) {
  const { auth } = loaderData;

  if (auth?.role === "PASSENGER") {
    return (
      <main className="page">
        {passengerNav(auth.name)}
        <MapContent />
      </main>
    );
  }

  if (auth?.role === "DRIVER") {
    return (
      <main className="page">
        {driverNav(auth.name)}
        <MapContent />
      </main>
    );
  }

  return (
    <PublicPage showSignIn className="map-page">
      <Link to="/" className="map-back-link">
        ← Back to home
      </Link>
      <MapContent />
    </PublicPage>
  );
}
