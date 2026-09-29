import { Form, Link, redirect, useActionData } from "react-router";
import type { Route } from "./+types/signup.passenger";
import { apiUrl } from "../lib/api";
import { getAuth, setAuth } from "../lib/auth.client";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Passenger signup · Oi Tesla" }];
}

export async function clientLoader() {
  const auth = getAuth();
  if (auth?.role === "PASSENGER") throw redirect("/passenger");
  if (auth?.role === "DRIVER") throw redirect("/driver");
  return null;
}

export async function clientAction({ request }: Route.ClientActionArgs) {
  const form = await request.formData();

  const body = {
    name: String(form.get("name") ?? "").trim(),
    email: String(form.get("email") ?? "").trim(),
    phone: String(form.get("phone") ?? "").trim(),
    password: String(form.get("password") ?? ""),
    gender: String(form.get("gender") ?? "MALE"),
  };

  if (!body.name || !body.email || !body.phone || !body.password) {
    return { error: "Please fill in all required fields" };
  }
  if (body.password.length < 8) {
    return { error: "Password must be at least 8 characters" };
  }

  const res = await fetch(apiUrl("/auth/passenger/register"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as { error?: string } | null;
    return { error: err?.error ?? "Signup failed" };
  }

  const { token, user } = (await res.json()) as {
    token: string;
    user: { name: string; role: "PASSENGER" };
  };

  setAuth({ token, role: user.role, name: user.name });
  throw redirect("/passenger");
}

export default function SignupPassenger() {
  const actionData = useActionData<typeof clientAction>();

  return (
    <main className="mx-auto max-w-lg p-6 pt-16">
      <h1 className="mb-2 text-2xl font-bold">Passenger signup</h1>
      <p className="mb-6 text-sm text-gray-500">
        Already have an account?{" "}
        <Link to="/login" className="text-emerald-700">
          Sign in
        </Link>
      </p>

      <Form method="post" className="space-y-3">
        <input
          name="name"
          placeholder="Full name"
          required
          className="input"
        />
        <input
          name="email"
          type="email"
          placeholder="Email"
          required
          className="input"
        />
        <input
          name="phone"
          placeholder="Phone"
          required
          className="input"
        />
        <input
          name="password"
          type="password"
          placeholder="Password (min 8)"
          required
          minLength={8}
          className="input"
        />

        <div className="flex gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input type="radio" name="gender" value="MALE" defaultChecked />
            Male
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" name="gender" value="FEMALE" />
            Female
          </label>
        </div>

        {actionData?.error ? (
          <p className="text-sm text-red-600">{actionData.error}</p>
        ) : null}

        <button type="submit" className="btn-primary w-full">
          Create account
        </button>
      </Form>
    </main>
  );
}
