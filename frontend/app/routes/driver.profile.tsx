import { Link, redirect, useLoaderData } from "react-router";
import type { Route } from "./+types/driver.profile";
import { getAuth } from "../lib/auth.client";
import { authJson } from "../lib/fetch.client";
import { formatGender } from "../lib/format";

type DriverProfile = {
  name: string;
  email: string;
  phone: string;
  gender: string;
  driver: {
    isOnline: boolean;
    teslas: { name: string; capacity: number; isActive: boolean }[];
  } | null;
};

export function meta({}: Route.MetaArgs) {
  return [{ title: "Profile · Oi Tesla" }];
}

export async function clientLoader() {
  const auth = getAuth();
  if (!auth || auth.role !== "DRIVER") {
    throw redirect("/login");
  }

  const { user } = await authJson<{ user: DriverProfile }>("/auth/driver/me");
  return { user };
}

export default function DriverProfilePage() {
  const { user } = useLoaderData<typeof clientLoader>();
  const tesla = user.driver?.teslas.find((car) => car.isActive);

  return (
    <main className="mx-auto max-w-lg p-6 pt-16">
      <Link to="/driver" className="text-sm text-blue-600">
        Back
      </Link>

      <h1 className="mt-4 text-2xl font-bold">Your profile</h1>
      <p className="mt-1 text-sm text-gray-600">Read-only</p>

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
        {tesla ? (
          <>
            <div>
              <dt className="text-gray-500">Tesla</dt>
              <dd>{tesla.name}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Capacity</dt>
              <dd>{tesla.capacity} seats</dd>
            </div>
          </>
        ) : null}
        <div>
          <dt className="text-gray-500">Online</dt>
          <dd>{user.driver?.isOnline ? "Yes" : "No"}</dd>
        </div>
      </dl>
    </main>
  );
}
