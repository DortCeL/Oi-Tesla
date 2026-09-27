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
    <main className="mx-auto max-w-lg p-6 pt-16">
      <h1 className="text-3xl font-bold">Dhaka Tesla Pool</h1>
      <p className="mt-2 text-gray-600">
        Share a seat. Split the fare. Survive Dhaka traffic.
      </p>
      <div className="mt-6 flex flex-col gap-3">
        <Link
          to="/login"
          className="inline-block rounded bg-gray-900 px-4 py-2 text-center text-white"
        >
          Sign in
        </Link>
        <Link
          to="/signup/passenger"
          className="inline-block rounded border px-4 py-2 text-center"
        >
          Passenger signup
        </Link>
        <Link
          to="/signup/driver"
          className="inline-block rounded border px-4 py-2 text-center"
        >
          Driver signup
        </Link>
      </div>
    </main>
  );
}
