import { Link, redirect } from "react-router";
import type { Route } from "./+types/home";
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
    <main className="page flex min-h-[80vh] flex-col justify-center">
      <div className="card text-center">
        <p className="text-5xl" aria-hidden>
          🛺
        </p>
        <h1 className="brand-title mt-4">Oi Tesla</h1>
        <p className="mt-2 text-gray-600">
          Share a seat. Split the fare. Survive Dhaka traffic.
        </p>
        <div className="mt-8 flex flex-col gap-3">
          <Link to="/login" className="btn-primary block text-center">
            Sign in
          </Link>
          <Link to="/signup/passenger" className="btn-secondary block text-center">
            Passenger signup
          </Link>
          <Link to="/signup/driver" className="btn-secondary block text-center">
            Driver signup 🛺
          </Link>
          <Link to="/map" className="text-sm text-emerald-700 hover:underline">
            View zone roadmap
          </Link>
        </div>
      </div>
    </main>
  );
}
