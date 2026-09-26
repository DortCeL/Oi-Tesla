import { Link } from "react-router";
import type { Route } from "./+types/home";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Oi Tesla" }];
}

export default function Home() {
  return (
    <main className="mx-auto max-w-lg p-6 pt-16">
      <h1 className="text-3xl font-bold">Dhaka Tesla Pool</h1>
      <p className="mt-2 text-gray-600">
        Share a seat. Split the fare. Survive Dhaka traffic.
      </p>
      <Link
        to="/login"
        className="mt-6 inline-block rounded bg-gray-900 px-4 py-2 text-white"
      >
        Sign in
      </Link>
    </main>
  );
}
