"use client";

import { useKitTrace } from "@/lib/hooks";
import type { RunTrace } from "@/lib/types";
import { useId, useState } from "react";
import { Alert, Badge, Card, Skeleton } from "../ui/primitives";

const STEP_LABEL: Record<string, string> = {
  extract: "Read the posting",
  crawl: "Crawl the company site",
  discussion: "Search public discussion",
  brief: "Write the company brief",
  questions: "Generate questions",
  coverage: "Check coverage",
  flashcards: "Write flashcards",
  schedule: "Build the schedule",
  validate: "Validate the kit",
};

const seconds = (ms: number) => (ms < 950 ? `${Math.max(0, Math.round(ms / 10) * 10)} ms` : `${(ms / 1000).toFixed(1)} s`);
const thousands = (value: number) => value.toLocaleString("en-GB");
const count = (value: number, one: string, many = `${one}s`) => `${thousands(value)} ${value === 1 ? one : many}`;

/**
 * What the run that made this kit actually did: how long each step took, every call to a model
 * and every page fetched. Loaded only when opened. A kit made before runs were traced shows nothing.
 */
export function KitRunTrace({ kitId, generator }: { kitId: string; generator?: { pipeline: string; prompts: string; models: string[] } }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const { data, error, isLoading } = useKitTrace(open ? kitId : null);

  return (
    <Card className="p-5" aria-labelledby="trace-heading">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 id="trace-heading" className="text-lg font-semibold">
            How this kit was made
          </h2>
          <p className="text-sm text-slate-600">Every step, model call and page fetch of the run. No prompt or page text is kept.</p>
        </div>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((value) => !value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
        >
          {open ? "Hide the run" : "Show the run"}
        </button>
      </div>

      <div id={panelId} hidden={!open} className="mt-4">
        {/* Opening the panel starts a request; someone who cannot see the skeleton is told the same thing in words. */}
        <p role="status" className="sr-only">
          {!open ? "" : isLoading ? "Loading the run." : error ? "The run could not be loaded." : data?.trace ? "The run is shown below." : "No run was recorded for this kit."}
        </p>
        {open && isLoading && <Skeleton className="h-40 w-full" />}
        {open && error && <Alert tone="error">The run could not be loaded: {error.message}</Alert>}
        {open && data && (data.trace ? <RunTraceView trace={data.trace} generator={generator} /> : <p className="text-sm text-slate-600">This kit was made before runs were recorded.</p>)}
      </div>
    </Card>
  );
}

export function RunTraceView({ trace, generator }: { trace: RunTrace; generator?: { pipeline: string; prompts: string; models: string[] } }) {
  const { totals } = trace;
  const longest = Math.max(1, ...trace.steps.map((step) => step.durationMs));
  const trouble = totals.retries + totals.repairs + totals.failovers;

  return (
    <div className="space-y-5">
      {trace.outcome === "failed" && trace.error && <Alert tone="error" title="This run did not produce a kit">{trace.error}</Alert>}

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Total time" value={seconds(trace.durationMs)} />
        <Stat label="Model calls" value={thousands(totals.llmCalls)} hint={trouble === 0 ? "none retried" : [totals.retries && count(totals.retries, "retry", "retries"), totals.repairs && count(totals.repairs, "repair"), totals.failovers && count(totals.failovers, "failover")].filter(Boolean).join(", ")} />
        <Stat label="Tokens in / out" value={`${thousands(totals.inputTokens)} / ${thousands(totals.outputTokens)}`} hint="as the provider counted them" />
        <Stat label="Pages fetched" value={thousands(totals.fetches)} hint={`${thousands(totals.pagesRead)} read as pages`} />
      </dl>

      <section aria-labelledby="trace-steps">
        <h3 id="trace-steps" className="text-sm font-semibold text-slate-700">
          Steps
        </h3>
        <ol className="mt-2 space-y-1.5">
          {trace.steps.map((step, index) => (
            <li key={`${step.step}-${index}`} className="grid grid-cols-[minmax(0,11rem)_minmax(0,1fr)_4.5rem] items-center gap-x-3 gap-y-0.5 text-sm">
              <span className="truncate font-medium text-slate-900">{STEP_LABEL[step.step] ?? step.step}</span>
              <span className="h-2 overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
                <span
                  className={step.status === "failed" || step.status === "unfinished" ? "block h-full rounded-full bg-red-500" : step.status === "skipped" ? "block h-full rounded-full bg-slate-400" : "block h-full rounded-full bg-indigo-500"}
                  style={{ width: `${Math.max(2, (step.durationMs / longest) * 100)}%` }}
                />
              </span>
              <span className="text-right tabular-nums text-slate-700">{seconds(step.durationMs)}</span>
              {(step.detail || step.status !== "done") && (
                <span className="col-span-3 text-xs text-slate-600">
                  {step.status !== "done" && <span className="font-medium">{step.status === "unfinished" ? "stopped here" : step.status}</span>}
                  {step.status !== "done" && step.detail ? ": " : ""}
                  {step.detail}
                </span>
              )}
            </li>
          ))}
        </ol>
      </section>

      {trace.decisions.length > 0 && (
        <section aria-labelledby="trace-decisions">
          <h3 id="trace-decisions" className="text-sm font-semibold text-slate-700">
            What code decided along the way
          </h3>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-slate-800">
            {trace.decisions.map((decision, index) => (
              <li key={index}>{decision.what}</li>
            ))}
          </ul>
        </section>
      )}

      <Details summary={`${count(trace.llmCalls.length, "model call")}, ${seconds(totals.llmMs)} answering and ${seconds(totals.queuedMs)} waiting for the rate limit`}>
        <Table
          caption="Every call to a model in this run"
          head={["Step", "Model", "Outcome", "Waited", "Took", "Tokens in / out"]}
          rows={trace.llmCalls.map((call) => [
            `${call.step}${call.kind === "repair" ? " (repair)" : ""}${call.attempt > 1 ? ` · try ${call.attempt}` : ""}`,
            call.provider,
            <span key="outcome">
              <Badge tone={call.outcome === "ok" ? "emerald" : call.outcome === "invalid_output" ? "amber" : "red"}>{call.outcome.replace(/_/g, " ")}</Badge>
              {call.error && <span className="mt-0.5 block text-xs text-slate-600">{call.error}</span>}
            </span>,
            seconds(call.queuedMs),
            seconds(call.latencyMs),
            call.usage ? `${thousands(call.usage.inputTokens)} / ${thousands(call.usage.outputTokens)}` : "not reported",
          ])}
        />
      </Details>

      <Details summary={`${count(trace.fetches.length, "fetch", "fetches")}, ${seconds(totals.fetchMs)} in total`}>
        <Table
          caption="Every address fetched in this run"
          head={["Address", "Outcome", "Took", "Size"]}
          rows={trace.fetches.map((fetch) => [
            <span key="url" className="break-all">{fetch.url}</span>,
            <Badge key="outcome" tone={fetch.outcome === "ok" ? "emerald" : "amber"}>{fetch.outcome === "ok" ? `ok${fetch.status ? ` ${fetch.status}` : ""}` : `${fetch.outcome.replace(/_/g, " ")}${fetch.status ? ` ${fetch.status}` : ""}`}</Badge>,
            seconds(fetch.durationMs),
            fetch.chars > 0 ? `${thousands(Math.round(fetch.chars / 1000))}k chars` : "",
          ])}
        />
      </Details>

      <p className="text-xs text-slate-600">
        Answered by {totals.models.length > 0 ? totals.models.join(", ") : "no model"}.
        {generator && ` Pipeline ${generator.pipeline}, prompts ${generator.prompts}.`} Started {new Date(trace.startedAt).toLocaleString("en-GB")}.
      </p>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string | false }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <dt className="text-xs font-medium text-slate-600">{label}</dt>
      <dd className="mt-0.5 text-lg font-semibold tabular-nums text-slate-900">{value}</dd>
      {hint && <dd className="text-xs text-slate-600">{hint}</dd>}
    </div>
  );
}

function Details({ summary, children }: { summary: string; children: React.ReactNode }) {
  return (
    <details className="group rounded-xl border border-slate-200">
      <summary className="cursor-pointer select-none rounded-xl px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600">{summary}</summary>
      <div className="border-t border-slate-200 p-2">{children}</div>
    </details>
  );
}

function Table({ caption, head, rows }: { caption: string; head: string[]; rows: React.ReactNode[][] }) {
  if (rows.length === 0) return <p className="p-2 text-sm text-slate-600">None.</p>;
  return (
    // A wide table on a narrow screen scrolls inside its own box, which must then be reachable by keyboard.
    <div className="overflow-x-auto" tabIndex={0} role="region" aria-label={caption}>
      <table className="w-full min-w-[36rem] text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="text-xs text-slate-600">
            {head.map((title) => (
              <th key={title} scope="col" className="px-2 py-1.5 font-medium">
                {title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((cells, index) => (
            <tr key={index} className="align-top">
              {cells.map((cell, cellIndex) => (
                <td key={cellIndex} className="px-2 py-1.5 tabular-nums text-slate-800">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
