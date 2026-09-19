"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { api, ApiError } from "@/lib/api";
import { LogoMark } from "./ui/logo";
import { Alert, Button, Field, Input } from "./ui/primitives";

const COPY = {
  login: { title: "Welcome back", submit: "Sign in", path: "/auth/login", other: { href: "/register", prompt: "No account yet?", label: "Create one" } },
  register: { title: "Create your account", submit: "Create account", path: "/auth/register", other: { href: "/login", prompt: "Already have an account?", label: "Sign in" } },
} as const;

/** What the product actually does, in the order it does it. */
const STEPS = [
  { title: "Reads the posting", body: "Only requirements the posting states, each traced to the line it came from. Nothing invented." },
  { title: "Researches the company", body: "Crawls their site for how they hire, and looks for people describing their interviews." },
  { title: "Builds a kit you can reshape", body: "Questions, flashcards and a day-by-day plan. Edit anything; regenerating never touches your work." },
  { title: "Follows your progress", body: "Practice finds your weak spots and re-plans the days you have left around them." },
];

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
    <div className="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      {/* The pitch. Hidden on small screens, where the form is what matters. */}
      <aside className="relative hidden overflow-hidden bg-slate-950 px-12 py-14 text-white lg:flex lg:flex-col lg:justify-between">
        <div aria-hidden="true" className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-indigo-500/30 blur-3xl" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-40 -left-24 h-96 w-96 rounded-full bg-sky-500/20 blur-3xl" />
        <p className="relative flex items-center gap-2.5 text-lg font-semibold tracking-tight">
          <LogoMark className="h-8 w-8" />
          Interview Prep Kit
        </p>
        <div className="relative">
          <h2 className="max-w-md text-4xl font-semibold leading-tight tracking-tight">
            Paste the job. <span className="bg-gradient-to-r from-indigo-300 to-sky-300 bg-clip-text text-transparent">Walk in prepared.</span>
          </h2>
          <ol className="mt-10 space-y-5">
            {STEPS.map((step, index) => (
              <li key={step.title} className="flex gap-4">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/10 text-sm font-semibold ring-1 ring-white/20">{index + 1}</span>
                <span>
                  <span className="block font-medium">{step.title}</span>
                  <span className="block text-sm leading-relaxed text-slate-300">{step.body}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
        <p className="relative text-sm text-slate-400">Honest by design: when a site cannot be read or a posting says little, the kit tells you so.</p>
      </aside>

      <main id="main" className="mx-auto flex w-full max-w-sm flex-col justify-center px-4 py-10">
        <p className="mb-8 flex items-center gap-2 font-semibold tracking-tight lg:hidden">
          <LogoMark />
          Interview Prep Kit
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">{copy.title}</h1>
        <p className="mt-1 text-sm text-slate-600">Turn a job description into a plan you can practise against.</p>

        <form onSubmit={submit} noValidate className="mt-6 space-y-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-card">
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
    </div>
  );
}
