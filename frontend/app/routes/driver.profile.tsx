import { redirect, useLoaderData } from "react-router";
import type { Route } from "./+types/driver.profile";
import { driverNav } from "../components/TopNav";
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
  return { name: auth.name, user };
}

export default function DriverProfilePage() {
  const { name, user } = useLoaderData<typeof clientLoader>();
  const tesla = user.driver?.teslas.find((car) => car.isActive);

  return (
    <main className="page">
      {driverNav(name)}

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
      </div>
    </main>
  );
}
