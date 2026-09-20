"use client";

import Link from "next/link";
import { isActive, useJobs, useKits } from "@/lib/hooks";
import type { Job, KitSummary } from "@/lib/types";
import { useRef } from "react";
import { api } from "@/lib/api";
import { ConfirmDialog, type ConfirmDialogHandle } from "../ui/confirm-dialog";
import { Alert, Badge, Button, Card, EmptyState, Skeleton, Spinner } from "../ui/primitives";

const linkButton = "inline-flex min-h-10 items-center rounded-lg bg-gradient-to-b from-indigo-500 to-indigo-600 px-4 text-sm font-medium text-white shadow-sm shadow-indigo-600/30 transition hover:to-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600";

/** Everything the user has: kits being generated or needing attention first, then finished kits. */
export function KitList() {
  const kits = useKits();
  const jobs = useJobs();

  // Finished jobs are represented by their kit; what stays visible here is work in progress and work that needs a decision.
  const unfinished = (jobs.data?.jobs ?? []).filter((job) => job.status !== "succeeded");
  const loading = kits.isLoading || jobs.isLoading;
  const nothingYet = !loading && !kits.error && (kits.data?.kits.length ?? 0) === 0 && unfinished.length === 0;

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">My kits</h1>
        {!nothingYet && (
          <Link href="/new" className={linkButton}>
            New kit
          </Link>
        )}
      </header>

      {unfinished.length > 0 && (
        <section aria-labelledby="in-progress">
          <h2 id="in-progress" className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
            In progress
          </h2>
          <ul className="space-y-2">
            {unfinished.map((job) => (
              <li key={job.id}>
                <JobRow job={job} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="ready" aria-busy={loading}>
        {(unfinished.length > 0 || loading) && (
          <h2 id="ready" className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Ready
          </h2>
        )}
        {loading && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
          </div>
        )}
        {kits.error && (
          <Alert tone="error" title="Could not load your kits" action={<Button size="sm" onClick={() => void kits.mutate()}>Try again</Button>}>
            {kits.error.message}
          </Alert>
        )}
        {nothingYet && (
          <EmptyState title="No kits yet" action={<Link href="/new" className={linkButton}>Create your first kit</Link>}>
            Paste a job description and the company&apos;s website, say how many days you have, and get a brief, a question bank, flashcards and a day-by-day plan.
          </EmptyState>
        )}
        {!loading && !kits.error && (kits.data?.kits.length ?? 0) > 0 && (
          <ul className="grid gap-3 sm:grid-cols-2">
            {kits.data!.kits.map((kit) => (
              <li key={kit.id}>
                <KitCard kit={kit} onDeleted={() => void kits.mutate()} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function JobRow({ job }: { job: Job }) {
  const current = job.steps.at(-1);
  return (
    <Link href={`/jobs/${job.id}`} className="flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-surface px-4 py-3 shadow-card transition hover:border-indigo-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600">
      {isActive(job) ? <Spinner className="h-5 w-5 shrink-0 text-indigo-600" /> : <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-full bg-red-500" />}
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium text-slate-900">{job.label}</span>
        <span className="block truncate text-sm text-slate-600">
          {isActive(job) ? (current ? `Step: ${current.step}` : "Waiting to start") : (job.error?.message ?? "Needs attention")}
        </span>
      </span>
      <Badge tone={isActive(job) ? "indigo" : "red"}>{isActive(job) ? "Generating" : job.status === "interrupted" ? "Interrupted" : "Failed"}</Badge>
    </Link>
  );
}

function KitCard({ kit, onDeleted }: { kit: KitSummary; onDeleted(): void }) {
  const dialog = useRef<ConfirmDialogHandle>(null);
  return (
    <Card className="relative h-full animate-rise transition duration-200 hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-lift">
      <button
        type="button"
        aria-label={`Delete the kit for ${kit.role || "this role"}`}
        title="Delete kit"
        onClick={() => dialog.current?.open()}
        className="absolute right-2 top-2 z-10 inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
        </svg>
      </button>
      <ConfirmDialog
        ref={dialog}
        title="Delete this kit?"
        confirmLabel="Delete kit"
        danger
        onConfirm={async () => {
          await api(`/kits/${kit.id}`, { method: "DELETE" });
          onDeleted();
        }}
      >
        <strong className="font-semibold">{kit.role || "This kit"}</strong>
        {kit.company ? ` at ${kit.company}` : ""}, with your edits and your practice progress, will be deleted for good.
      </ConfirmDialog>
      <Link href={`/kits/${kit.id}`} className="block h-full rounded-2xl p-4 pr-10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600">
        <p className="font-semibold text-slate-900">{kit.role || "Untitled role"}</p>
        <p className="text-sm text-slate-600">{kit.company || "Company not identified"}</p>
        <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
          {[
            [kit.questionCount, "questions"],
            [kit.flashcardCount, "flashcards"],
            [kit.daysAvailable, kit.daysAvailable === 1 ? "day" : "days"],
          ].map(([value, label]) => (
            <div key={label} className="rounded-xl bg-slate-50 px-2 py-2">
              <dd className="text-lg font-semibold leading-none text-slate-900">{value}</dd>
              <dt className="mt-1 text-xs text-slate-600">{label}</dt>
            </div>
          ))}
        </dl>
        {kit.notes.length > 0 && (
          <p className="mt-2">
            <Badge tone="amber" title={kit.notes.join(" ")}>
              {kit.notes.length} note{kit.notes.length === 1 ? "" : "s"} about what could not be found
            </Badge>
          </p>
        )}
        <p className="mt-3 text-xs text-slate-500">Updated {new Date(kit.updatedAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}</p>
      </Link>
    </Card>
  );
}
