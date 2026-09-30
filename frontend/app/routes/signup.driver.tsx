import { Form, Link, redirect, useActionData } from "react-router";
import type { Route } from "./+types/signup.driver";
import { AuthShell } from "../components/auth/AuthShell";
import { FormField } from "../components/auth/FormField";
import { apiUrl } from "../lib/api";
import { getAuth, setAuth } from "../lib/auth.client";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Driver signup · Oi Tesla" }];
}

export async function clientLoader() {
  const auth = getAuth();
  if (auth?.role === "PASSENGER") throw redirect("/passenger");
  if (auth?.role === "DRIVER") throw redirect("/driver");
  return null;
}

export async function clientAction({ request }: Route.ClientActionArgs) {
  const form = await request.formData();

  const teslaName = String(form.get("teslaName") ?? "").trim();
  const capacityRaw = String(form.get("capacity") ?? "").trim();
  const capacity = Number(capacityRaw);

  const body = {
    name: String(form.get("name") ?? "").trim(),
    email: String(form.get("email") ?? "").trim(),
    phone: String(form.get("phone") ?? "").trim(),
    password: String(form.get("password") ?? ""),
    gender: String(form.get("gender") ?? "MALE"),
    tesla: {
      name: teslaName,
      capacity,
    },
  };

  if (!body.name || !body.email || !body.phone || !body.password) {
    return { error: "Please fill in all required fields" };
  }
  if (body.password.length < 8) {
    return { error: "Password must be at least 8 characters" };
  }
  if (!teslaName) {
    return { error: "Tesla name is required" };
  }
  if (
    !capacityRaw ||
    !Number.isInteger(capacity) ||
    capacity < 1 ||
    capacity > 20
  ) {
    return { error: "Capacity must be a whole number from 1 to 20" };
  }

  const res = await fetch(apiUrl("/auth/driver/register"), {
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
    user: { name: string; role: "DRIVER" };
  };

  setAuth({ token, role: user.role, name: user.name });
  throw redirect("/driver");
}

export default function SignupDriver() {
  const actionData = useActionData<typeof clientAction>();

  return (
    <AuthShell
      badge="Driver"
      title="Join as a driver"
      subtitle="Register your Tesla, set your zones, and start accepting ride stacks."
      footer={
        <div className="auth-footer-links">
          <div className="auth-footer-link-row">
            <span>Already registered?</span>
            <Link to="/login?role=driver" className="auth-footer-link">
              Sign in
            </Link>
          </div>
          <div className="auth-footer-link-row">
            <span>Riding instead?</span>
            <Link to="/signup/passenger" className="auth-footer-link">
              Passenger signup
            </Link>
          </div>
        </div>
      }
    >
      <Form method="post" className="form-section">
        <p className="form-section-title">About you</p>

        <FormField label="Full name" htmlFor="name">
          <input id="name" name="name" required autoComplete="name" className="input" />
        </FormField>

        <FormField label="Email" htmlFor="email">
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            className="input"
          />
        </FormField>

        <FormField label="Phone" htmlFor="phone" hint="Used for account recovery and sign-in.">
          <input
            id="phone"
            name="phone"
            type="tel"
            required
            autoComplete="tel"
            className="input"
          />
        </FormField>

        <FormField label="Gender" htmlFor="gender-male">
          <div className="gender-options">
            <label className="gender-option" htmlFor="gender-male">
              <input type="radio" id="gender-male" name="gender" value="MALE" defaultChecked />
              Male
            </label>
            <label className="gender-option" htmlFor="gender-female">
              <input type="radio" id="gender-female" name="gender" value="FEMALE" />
              Female
            </label>
          </div>
        </FormField>

        <p className="form-section-title pt-2">Security</p>

        <FormField label="Password" htmlFor="password" hint="At least 8 characters.">
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            className="input"
          />
        </FormField>

        <p className="form-section-title pt-2">Your Tesla</p>

        <FormField label="Tesla name" htmlFor="teslaName" hint="What passengers will see on your ride.">
          <input id="teslaName" name="teslaName" required className="input" />
        </FormField>

        <FormField label="Seat capacity" htmlFor="capacity" hint="Passenger seats available (1–20).">
          <input
            id="capacity"
            name="capacity"
            type="number"
            min={1}
            max={20}
            required
            className="input"
          />
        </FormField>

        {actionData?.error ? (
          <p className="form-error" role="alert">
            {actionData.error}
          </p>
        ) : null}

        <button type="submit" className="btn-primary w-full">
          Create driver account
        </button>
      </Form>
    </AuthShell>
  );
}
