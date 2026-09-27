import { Link, redirect, useLoaderData } from "react-router";
import type { Route } from "./+types/passenger.profile";
import { getAuth } from "../lib/auth.client";
import { authJson } from "../lib/fetch.client";
import { displayHobbies, displayOptional, formatGender } from "../lib/format";

type PassengerProfile = {
  name: string;
  email: string;
  phone: string;
  gender: string;
  hobbies: string[];
  passenger: {
    occupation: string | null;
    affiliation: string | null;
  } | null;
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
  return { user };
}

export default function PassengerProfilePage() {
  const { user } = useLoaderData<typeof clientLoader>();

  return (
    <main className="mx-auto max-w-lg p-6 pt-16">
      <Link to="/passenger" className="text-sm text-blue-600">
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
        <div>
          <dt className="text-gray-500">Occupation</dt>
          <dd>{displayOptional(user.passenger?.occupation)}</dd>
        </div>
        <div>
          <dt className="text-gray-500">Affiliation</dt>
          <dd>{displayOptional(user.passenger?.affiliation)}</dd>
        </div>
        <div>
          <dt className="text-gray-500">Hobbies</dt>
          <dd>{displayHobbies(user.hobbies)}</dd>
        </div>
      </dl>
    </main>
  );
}
