import { Link, redirect } from "react-router";
import type { Route } from "./+types/home";
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
    <main className="entry-page flex min-h-[85vh] flex-col justify-center">
      <header className="entry-hero">
        <p className="entry-hero-mark" aria-hidden>
          🛺
        </p>
        <h1 className="entry-hero-title">Oi Tesla</h1>
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
    </main>
  );
}
