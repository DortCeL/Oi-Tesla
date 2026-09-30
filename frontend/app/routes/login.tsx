import { useState } from "react";
import { Form, Link, redirect, useActionData, useSearchParams } from "react-router";
import type { Route } from "./+types/login";
import { AuthShell } from "../components/auth/AuthShell";
import { FormField } from "../components/auth/FormField";
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

function initialRole(searchParams: URLSearchParams): AuthRole {
  const role = searchParams.get("role");
  if (role === "driver") return "DRIVER";
  return "PASSENGER";
}

export default function Login() {
  const actionData = useActionData<typeof clientAction>();
  const [searchParams] = useSearchParams();
  const [role, setRole] = useState<AuthRole>(() => initialRole(searchParams));

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to book rides or go online as a driver."
      footer={
        <div className="auth-footer-links">
          <p>New here? Create an account:</p>
          <div className="auth-alt-signup">
            <Link
              to="/signup/passenger"
              className={`auth-alt-signup-link ${role === "PASSENGER" ? "auth-alt-signup-link-active" : ""}`}
            >
              Passenger signup
            </Link>
            <Link
              to="/signup/driver"
              className={`auth-alt-signup-link ${role === "DRIVER" ? "auth-alt-signup-link-active" : ""}`}
            >
              Driver signup
            </Link>
          </div>
        </div>
      }
    >
      <Form method="post" className="form-section">
        <input type="hidden" name="role" value={role} />

        <div className="form-field">
          <p className="form-label" id="login-role-label">
            I am a
          </p>
          <div
            className="auth-role-tabs"
            role="tablist"
            aria-labelledby="login-role-label"
          >
            <button
              id="login-role-passenger"
              type="button"
              role="tab"
              aria-selected={role === "PASSENGER"}
              className={`auth-role-tab ${role === "PASSENGER" ? "auth-role-tab-selected" : ""}`}
              onClick={() => setRole("PASSENGER")}
            >
              👤 Passenger
            </button>
            <button
              id="login-role-driver"
              type="button"
              role="tab"
              aria-selected={role === "DRIVER"}
              className={`auth-role-tab ${role === "DRIVER" ? "auth-role-tab-selected" : ""}`}
              onClick={() => setRole("DRIVER")}
            >
              🛺 Driver
            </button>
          </div>
        </div>

        <FormField label="Email or phone" htmlFor="emailOrPhone">
          <input
            id="emailOrPhone"
            name="emailOrPhone"
            required
            autoComplete="username"
            className="input"
          />
        </FormField>

        <FormField label="Password" htmlFor="password">
          <input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
            className="input"
          />
        </FormField>

        {actionData?.error ? (
          <p className="form-error" role="alert">
            {actionData.error}
          </p>
        ) : null}

        <button type="submit" className="btn-primary w-full">
          Sign in as {role === "DRIVER" ? "driver" : "passenger"}
        </button>
      </Form>
    </AuthShell>
  );
}
