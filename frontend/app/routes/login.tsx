import { useState } from "react";
import { Form, Link, redirect, useActionData } from "react-router";
import type { Route } from "./+types/login";
import { ChoiceTabs } from "../components/ChoiceTabs";
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

  if (!emailOrPhone || !password) {
    return { error: "Email/phone and password are required" };
  }

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
  const [role, setRole] = useState<AuthRole>("PASSENGER");

  return (
    <main className="page">
      <div className="card">
        <h1 className="brand-title">Sign in</h1>

        <Form method="post" className="mt-6 space-y-4">
          <input type="hidden" name="role" value={role} />
          <ChoiceTabs
            label="I am a"
            value={role}
            onChange={(v) => setRole(v as AuthRole)}
            options={[
              { value: "PASSENGER", label: "Passenger" },
              { value: "DRIVER", label: "Driver 🛺" },
            ]}
          />

          <input
            name="emailOrPhone"
            placeholder="Email or phone"
            required
            autoComplete="username"
            className="input"
          />
          <input
            name="password"
            type="password"
            placeholder="Password"
            required
            autoComplete="current-password"
            className="input"
          />

          {actionData?.error ? (
            <p className="text-sm text-red-600">{actionData.error}</p>
          ) : null}

          <button type="submit" className="btn-primary w-full">
            Sign in
          </button>
        </Form>

        <p className="mt-6 text-sm text-gray-500">
          No account?{" "}
          <Link to="/signup/passenger" className="text-emerald-700">
            Passenger
          </Link>{" "}
          or{" "}
          <Link to="/signup/driver" className="text-emerald-700">
            Driver
          </Link>{" "}
          signup
        </p>
        <p className="mt-2 text-sm text-gray-400">
          Demo: nusrat@oitesla.test or jashim@oitesla.test — password123
        </p>
      </div>
    </main>
  );
}
