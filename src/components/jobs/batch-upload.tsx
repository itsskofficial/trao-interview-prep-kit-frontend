"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { api, ApiError, type FieldIssue } from "@/lib/api";
import type { Job } from "@/lib/types";
import { Alert, Badge, Button, Card } from "../ui/primitives";

interface CaseDraft {
  id?: string;
  jd?: unknown;
  company_url?: unknown;
  days?: unknown;
}

type BatchResult =
  | { index: number; outcome: "started" | "already_running"; job: Job }
  | { index: number; outcome: "kit_exists"; kitId: string }
  | { index: number; outcome: "invalid"; issues: FieldIssue[] }
  | { index: number; outcome: "limited"; message: string };

const MAX_CASES = 10;
const EXAMPLE = `[
  { "id": "role-1", "jd": "Senior Backend Engineer\\n\\nRequirements\\n- ...", "company_url": "https://company.com", "days": 5 }
]`;

const firstLine = (value: unknown) => (typeof value === "string" ? (value.split(/\r?\n/).find((line) => line.trim())?.trim().slice(0, 80) ?? "") : "");

/** Preparing for several roles at once: a JSON file of description-and-company pairs, the same shape the batch command reads. */
export function BatchUpload() {
  const inputId = useId();
  const [cases, setCases] = useState<CaseDraft[] | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [results, setResults] = useState<BatchResult[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function read(file: File | undefined) {
    setCases(null);
    setResults(null);
    setFileError(null);
    setError(null);
    if (!file) return;
    if (file.size > 900_000) return setFileError("That file is too large. Keep it under 900 KB.");
    try {
      const parsed: unknown = JSON.parse(await file.text());
      if (!Array.isArray(parsed)) return setFileError("The file must contain a JSON array of cases.");
      if (parsed.length === 0) return setFileError("The file has no cases in it.");
      if (parsed.length > MAX_CASES) return setFileError(`The file has ${parsed.length} cases. Upload at most ${MAX_CASES} at a time.`);
      const notObject = parsed.findIndex((entry) => typeof entry !== "object" || entry === null || Array.isArray(entry));
      if (notObject !== -1) return setFileError(`Entry ${notObject + 1} is not a case. Each entry must be an object with jd, company_url and days.`);
      setCases(parsed as CaseDraft[]);
    } catch {
      setFileError("That file is not valid JSON.");
    }
  }

  async function start() {
    if (!cases) return;
    setBusy(true);
    setError(null);
    try {
      const response = await api<{ results: BatchResult[] }>("/jobs/batch", { method: "POST", body: { cases } });
      setResults(response.results);
    } catch (failure) {
      setError(failure instanceof ApiError ? failure.message : "Could not start these. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="space-y-4 p-5">
      <div>
        <h2 className="font-semibold">Several roles at once</h2>
        <p className="mt-1 text-sm text-slate-600">Upload a JSON file with one entry per role. Each becomes its own kit, generated two at a time.</p>
      </div>

      <div>
        <label htmlFor={inputId} className="block text-sm font-medium text-slate-800">
          Cases file
        </label>
        <input
          id={inputId}
          type="file"
          accept="application/json,.json"
          onChange={(event) => void read(event.target.files?.[0])}
          className="mt-1.5 block w-full text-sm text-slate-700 file:mr-3 file:rounded-md file:border file:border-slate-300 file:bg-white file:px-3 file:py-2 file:text-sm file:font-medium hover:file:bg-slate-50"
          aria-describedby={`${inputId}-format`}
        />
        <details id={`${inputId}-format`} className="mt-2 text-sm text-slate-600">
          <summary className="cursor-pointer rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600">File format</summary>
          <pre className="mt-2 overflow-x-auto rounded-md bg-slate-900 p-3 text-xs text-slate-100">{EXAMPLE}</pre>
        </details>
      </div>

      {fileError && <Alert tone="error">{fileError}</Alert>}
      {error && <Alert tone="error">{error}</Alert>}

      {cases && (
        <>
          <ul className="divide-y divide-slate-100 rounded-md border border-slate-200 text-sm">
            {cases.map((entry, index) => {
              const result = results?.find((candidate) => candidate.index === index);
              return (
                <li key={index} className="flex flex-wrap items-start justify-between gap-2 px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-900">{firstLine(entry.jd) || `Case ${index + 1}`}</p>
                    <p className="truncate text-slate-600">
                      {typeof entry.company_url === "string" ? entry.company_url : "no company website"} · {typeof entry.days === "number" ? `${entry.days} days` : "no days"}
                    </p>
                    {result?.outcome === "limited" && <p className="mt-1 text-amber-800">{result.message}</p>}
                    {result?.outcome === "invalid" && (
                      <ul className="mt-1 text-red-700">
                        {result.issues.map((issue) => (
                          <li key={issue.field}>
                            <span className="font-mono text-xs">{issue.field}</span>: {issue.message}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  {result && <ResultBadge result={result} />}
                </li>
              );
            })}
          </ul>
          {!results && (
            <Button variant="primary" busy={busy} onClick={() => void start()}>
              Generate {cases.length} kit{cases.length === 1 ? "" : "s"}
            </Button>
          )}
          {results && (
            <p className="text-sm text-slate-600">
              Progress for each one is under{" "}
              <Link href="/" className="font-medium text-indigo-700 underline underline-offset-2">
                My kits
              </Link>
              .
            </p>
          )}
        </>
      )}
    </Card>
  );
}

function ResultBadge({ result }: { result: BatchResult }) {
  if (result.outcome === "invalid") return <Badge tone="red">Not started</Badge>;
  if (result.outcome === "limited") return <Badge tone="amber">Over this hour&apos;s allowance</Badge>;
  if (result.outcome === "kit_exists") {
    return (
      <Link href={`/kits/${result.kitId}`} className="text-sm font-medium text-indigo-700 underline underline-offset-2">
        Already have this kit
      </Link>
    );
  }
  return (
    <Link href={`/jobs/${result.job.id}`} className="text-sm font-medium text-indigo-700 underline underline-offset-2">
      {result.outcome === "started" ? "Started: watch progress" : "Already running: watch progress"}
    </Link>
  );
}
