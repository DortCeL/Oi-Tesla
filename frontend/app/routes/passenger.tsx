import { redirect, useLoaderData, useNavigate } from "react-router";
import type { Route } from "./+types/passenger";
import { clearAuth, getAuth } from "../lib/auth.client";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Passenger · Oi Tesla" }];
}

export async function clientLoader() {
  const auth = getAuth();
  if (!auth || auth.role !== "PASSENGER") {
    throw redirect("/login");
  }
  return { name: auth.name };
}

export default function PassengerHome() {
  const { name } = useLoaderData<typeof clientLoader>();
  const navigate = useNavigate();

  function logout() {
    clearAuth();
    void navigate("/login");
  }

  return (
    <main className="mx-auto max-w-lg p-6 pt-16">
      <h1 className="text-2xl font-bold">Hi, {name}</h1>
      <p className="mt-2 text-gray-600">Passenger home — booking comes next.</p>
      <button
        type="button"
        onClick={logout}
        className="mt-6 text-sm text-blue-600"
      >
        Logout
      </button>
    </main>
  );
}
