import { redirect, useLoaderData } from "react-router";
import type { Route } from "./+types/passenger.profile";
import { passengerNav } from "../components/TopNav";
import { getAuth } from "../lib/auth.client";
import { authJson } from "../lib/fetch.client";
import { formatGender } from "../lib/format";

type PassengerProfile = {
  name: string;
  email: string;
  phone: string;
  gender: string;
};

export function meta({}: Route.MetaArgs) {
  return [{ title: "Profile · Oi Tesla" }];
}

export async function clientLoader() {
  const auth = getAuth();
  if (!auth || auth.role !== "PASSENGER") {
    throw redirect("/login");
  }

  const { user } = await authJson<{ user: PassengerProfile }>("/auth/passenger/me");
  return { name: auth.name, user };
}

export default function PassengerProfilePage() {
  const { name, user } = useLoaderData<typeof clientLoader>();

  return (
    <main className="page">
      {passengerNav(name)}

      <div className="card">
      <h1 className="text-xl font-bold">Your profile</h1>
      <p className="mt-1 text-sm text-gray-500">Read-only</p>

      <dl className="mt-6 space-y-3 text-sm">
        <div>
          <dt className="text-gray-500">Name</dt>
          <dd className="font-medium">{user.name}</dd>
        </div>
        <div>
          <dt className="text-gray-500">Email</dt>
          <dd>{user.email}</dd>
        </div>
        <div>
          <dt className="text-gray-500">Phone</dt>
          <dd>{user.phone}</dd>
        </div>
        <div>
          <dt className="text-gray-500">Gender</dt>
          <dd>{formatGender(user.gender)}</dd>
        </div>
      </dl>
      </div>
    </main>
  );
}
