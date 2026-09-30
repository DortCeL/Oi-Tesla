import { Link, redirect } from "react-router";
import type { Route } from "./+types/home";
import { PublicPage } from "../components/auth/PublicPage";
import { RoleCard } from "../components/auth/RoleCard";
import { getAuth } from "../lib/auth.client";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Oi Tesla" }];
}

export async function clientLoader() {
  const auth = getAuth();
  if (auth?.role === "PASSENGER") {
    throw redirect("/passenger");
  }
  if (auth?.role === "DRIVER") {
    throw redirect("/driver");
  }
  return null;
}

export default function Home() {
  return (
    <PublicPage className="entry-page">
      <header className="entry-hero">
        <p className="entry-hero-kicker">Tesla pooling across Dhaka</p>
        <p className="entry-hero-tagline">
          Share a seat. Split the fare. Survive Dhaka traffic.
        </p>
      </header>

      <div className="entry-role-grid">
        <RoleCard
          emoji="👤"
          title="Passenger"
          description="Book a solo or shared ride across the zone map. Split fares with pool mates on your route."
          loginTo="/login?role=passenger"
          signupTo="/signup/passenger"
          accent="passenger"
        />
        <RoleCard
          emoji="🛺"
          title="Driver"
          description="Go online, pick your zones, and accept stacked requests. Earn from every seat you fill."
          loginTo="/login?role=driver"
          signupTo="/signup/driver"
          accent="driver"
        />
      </div>

      <Link to="/map" className="entry-map-link">
        View zone roadmap →
      </Link>
    </PublicPage>
  );
}
