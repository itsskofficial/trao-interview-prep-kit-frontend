"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { api, ApiError } from "@/lib/api";
import { Alert, Button, Field, Input } from "./ui/primitives";

const COPY = {
  login: { title: "Sign in", submit: "Sign in", path: "/auth/login", other: { href: "/register", prompt: "No account yet?", label: "Create one" } },
  register: { title: "Create your account", submit: "Create account", path: "/auth/register", other: { href: "/login", prompt: "Already have an account?", label: "Sign in" } },
} as const;

/** Only ever send the user to a path on this site, never to wherever a link told us to. */
function safeNext(next: string | null): string {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

export function AuthForm({ mode }: { mode: keyof typeof COPY }) {
  const copy = COPY[mode];
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api(copy.path, { method: "POST", body: { email, password }, redirectOn401: false });
      // A full navigation, so the proxy sees the new session cookie.
      window.location.assign(safeNext(params.get("next")));
    } catch (failure) {
      setError(failure instanceof ApiError ? failure : new ApiError(0, "UNKNOWN", "Something went wrong. Try again."));
      setBusy(false);
    }
  }

  const fields = error?.fields ?? {};
  const general = error && Object.keys(fields).length === 0 ? error.message : null;
  const next = params.get("next");
  const otherHref = next ? `${copy.other.href}?next=${encodeURIComponent(next)}` : copy.other.href;

  return (
    <main id="main" className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">{copy.title}</h1>
      <p className="mt-1 text-sm text-slate-600">Interview Prep Kit turns a job description into a plan you can practise against.</p>

      <form onSubmit={submit} noValidate className="mt-6 space-y-4 rounded-lg border border-slate-200 bg-white p-5">
        {params.get("reason") === "expired" && !error && <Alert tone="warning">Your session expired. Sign in again to carry on where you left off.</Alert>}
        {general && <Alert tone="error">{general}</Alert>}

        <Field id="email" label="Email" error={fields.email}>
          {(props) => <Input {...props} type="email" autoComplete="email" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} />}
        </Field>
        <Field id="password" label="Password" hint={mode === "register" ? "At least 8 characters." : undefined} error={fields.password}>
          {(props) => (
            <Input {...props} type="password" autoComplete={mode === "register" ? "new-password" : "current-password"} required value={password} onChange={(e) => setPassword(e.target.value)} />
          )}
        </Field>

        <Button type="submit" variant="primary" busy={busy} className="w-full">
          {copy.submit}
        </Button>
      </form>

      <p className="mt-4 text-sm text-slate-600">
        {copy.other.prompt}{" "}
        <Link href={otherHref} className="font-medium text-indigo-700 underline underline-offset-2 hover:text-indigo-900">
          {copy.other.label}
        </Link>
      </p>
    </main>
  );
}
