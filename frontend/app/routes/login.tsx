import { Form, redirect, useActionData } from "react-router";
import type { Route } from "./+types/login";
import { apiUrl } from "../lib/api";
import { getAuth, setAuth, type AuthRole } from "../lib/auth.client";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Sign in · Oi Tesla" }];
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

export async function clientAction({ request }: Route.ClientActionArgs) {
  const form = await request.formData();
  const role = form.get("role") as AuthRole;
  const emailOrPhone = String(form.get("emailOrPhone") ?? "").trim();
  const password = String(form.get("password") ?? "");

  const path =
    role === "DRIVER" ? "/auth/driver/login" : "/auth/passenger/login";

  const res = await fetch(apiUrl(path), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ emailOrPhone, password }),
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    return { error: body?.error ?? "Login failed" };
  }

  const { token, user } = (await res.json()) as {
    token: string;
    user: { name: string; role: AuthRole };
  };

  setAuth({ token, role: user.role, name: user.name });
  throw redirect(user.role === "DRIVER" ? "/driver" : "/passenger");
}

export default function Login() {
  const actionData = useActionData<typeof clientAction>();

  return (
    <main className="mx-auto max-w-lg p-6 pt-16">
      <h1 className="mb-6 text-2xl font-bold">Sign in</h1>

      <Form method="post" className="space-y-4">
        <div className="flex gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input type="radio" name="role" value="PASSENGER" defaultChecked />
            Passenger
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" name="role" value="DRIVER" />
            Driver
          </label>
        </div>

        <input
          name="emailOrPhone"
          placeholder="Email or phone"
          className="w-full rounded border px-3 py-2"
        />
        <input
          name="password"
          type="password"
          placeholder="Password"
          className="w-full rounded border px-3 py-2"
        />

        {actionData?.error ? (
          <p className="text-sm text-red-600">{actionData.error}</p>
        ) : null}

        <button
          type="submit"
          className="w-full rounded bg-gray-900 py-2 text-white"
        >
          Sign in
        </button>
      </Form>

      <p className="mt-6 text-sm text-gray-500">
        Demo: nusrat@oitesla.test or jashim@oitesla.test — password123
      </p>
    </main>
  );
}
