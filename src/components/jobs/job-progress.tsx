"use client";

import clsx from "clsx";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { isActive, useJob } from "@/lib/hooks";
import type { Job, JobStep } from "@/lib/types";
import { Alert, Button, Card, Skeleton, Spinner } from "../ui/primitives";

/** The pipeline's steps in order, in words a candidate would use. */
const STEPS: Array<{ id: string; label: string; running: string }> = [
  { id: "extract", label: "Read the job description", running: "Pulling out the requirements the posting actually states" },
  { id: "crawl", label: "Crawl the company site", running: "Ranking links and looking for how they hire" },
  { id: "discussion", label: "Search public discussion", running: "Looking for people describing their interviews there" },
  { id: "brief", label: "Write the company brief", running: "Summarising only what was found" },
  { id: "questions", label: "Generate questions by category", running: "One pass per category, shaped by their hiring process" },
  { id: "coverage", label: "Check coverage and close gaps", running: "Making sure every must-have has a question" },
  { id: "flashcards", label: "Write flashcards", running: "Short recall cards tied to the requirements" },
  { id: "schedule", label: "Build the schedule", running: "Spreading the material across your days" },
  { id: "validate", label: "Validate the kit", running: "Checking the structure before saving" },
];

type StepState = "pending" | "running" | "done" | "skipped" | "failed";

function stateOf(steps: JobStep[], id: string): { state: StepState; detail?: string } {
  const last = steps.filter((step) => step.step === id).at(-1);
  if (!last) return { state: "pending" };
  return { state: last.status === "started" ? "running" : last.status, detail: last.detail };
}

function StepIcon({ state }: { state: StepState }) {
  if (state === "running") return <Spinner className="h-5 w-5 text-indigo-600" />;
  const look: Record<Exclude<StepState, "running">, [string, string]> = {
    pending: ["border-slate-300 bg-white text-transparent", ""],
    done: ["border-emerald-600 bg-emerald-600 text-white", "M5 13l4 4L19 7"],
    skipped: ["border-slate-400 bg-slate-100 text-slate-500", "M6 12h12"],
    failed: ["border-amber-500 bg-amber-100 text-amber-700", "M12 7v6m0 4h.01"],
  };
  const [classes, path] = look[state];
  return (
    <span className={clsx("flex h-5 w-5 items-center justify-center rounded-full border", classes)} aria-hidden="true">
      {path && (
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <path d={path} />
        </svg>
      )}
    </span>
  );
}

const STATE_WORD: Record<StepState, string> = { pending: "not started", running: "in progress", done: "done", skipped: "nothing found", failed: "could not be completed" };

export function JobProgress({ id }: { id: string }) {
  const router = useRouter();
  const { data, error, isLoading, mutate } = useJob(id);
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);
  const job = data?.job;

  // When the kit is ready, take the user to it. They can also get there from the link, or later from "My kits".
  useEffect(() => {
    if (job?.status !== "succeeded" || !job.kitId) return;
    const timer = setTimeout(() => router.push(`/kits/${job.kitId}`), 1_200);
    return () => clearTimeout(timer);
  }, [job?.status, job?.kitId, router]);

  async function retry() {
    setRetrying(true);
    setRetryError(null);
    try {
      await api(`/jobs/${id}/retry`, { method: "POST" });
      await mutate();
    } catch (failure) {
      setRetryError(failure instanceof ApiError ? failure.message : "Could not retry. Try again.");
    } finally {
      setRetrying(false);
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-3" aria-busy="true" aria-label="Loading progress">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (error || !job) {
    return (
      <Alert tone="error" title={error?.status === 404 ? "This job does not exist" : "Could not load progress"} action={error?.status === 404 ? undefined : <Button size="sm" onClick={() => void mutate()}>Try again</Button>}>
        {error?.status === 404 ? <Link href="/" className="underline">Back to my kits</Link> : error?.message}
      </Alert>
    );
  }

  return (
    <div className="space-y-5">
      <header>
        <p className="text-sm text-slate-600">{headline(job)}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">{job.label}</h1>
        <p className="mt-1 break-all text-sm text-slate-600">
          {job.companyUrl} · {job.days} day{job.days === 1 ? "" : "s"}
        </p>
      </header>

      {job.status === "succeeded" && job.kitId && (
        <Alert tone="success" title="Your kit is ready" action={<Link href={`/kits/${job.kitId}`} className="font-medium underline">Open the kit</Link>}>
          Opening it now.
        </Alert>
      )}
      {(job.status === "failed" || job.status === "interrupted") && (
        <Alert tone="error" title={job.status === "interrupted" ? "Generation was interrupted" : "The kit could not be generated"} action={<Button size="sm" variant="primary" busy={retrying} onClick={() => void retry()}>Try again</Button>}>
          {job.error?.message ?? "Something went wrong."}
          {retryError && <p className="mt-1 font-medium">{retryError}</p>}
        </Alert>
      )}
      {isActive(job) && <p className="text-sm text-slate-600">This usually takes one to two minutes. You can leave this page; the kit will be under My kits when it is done.</p>}

      <Card className="p-0">
        {/* Announced politely, so a screen reader hears each step finish without being interrupted. */}
        <ol aria-live="polite" className="divide-y divide-slate-100">
          {STEPS.map((step, index) => {
            const { state, detail } = stateOf(job.steps, step.id);
            return (
              <li key={step.id} className="flex gap-3 px-4 py-3">
                <span className="mt-0.5 shrink-0"><StepIcon state={state} /></span>
                <div className="min-w-0">
                  <p className={clsx("text-sm font-medium", state === "pending" ? "text-slate-500" : "text-slate-900")}>
                    <span className="sr-only">Step {index + 1}, {STATE_WORD[state]}: </span>
                    {step.label}
                  </p>
                  {state === "running" && <p className="text-sm text-slate-600">{step.running}</p>}
                  {state !== "running" && detail && <p className={clsx("text-sm", state === "failed" ? "text-amber-800" : "text-slate-600")}>{detail}</p>}
                  {state === "failed" && step.id !== "extract" && <p className="text-sm text-slate-600">The kit carries on without this and says so.</p>}
                </div>
              </li>
            );
          })}
        </ol>
      </Card>
    </div>
  );
}

function headline(job: Job): string {
  switch (job.status) {
    case "queued": return "Waiting for a free slot";
    case "running": return "Generating your kit";
    case "succeeded": return "Done";
    case "failed": return "Failed";
    case "interrupted": return "Interrupted";
  }
}
