"use client";

import { useState } from "react";
import useSWR from "swr";
import { ApiError, fetcher } from "@/lib/api";
import type { KitEditor } from "@/lib/kit-editor";
import type { PracticeOverview, ScheduleDay } from "@/lib/types";
import { Alert, Badge, Button, Card } from "../ui/primitives";

const WEEK = 7;

export function ScheduleTab({ kitId, editor }: { kitId: string; editor: KitEditor }) {
  const { kit, actions } = editor;
  const practice = useSWR<PracticeOverview, ApiError>(`/kits/${kitId}/practice`, fetcher, { revalidateOnFocus: false });
  const [fromDayText, setFromDayText] = useState("1");
  const [busy, setBusy] = useState<"replan" | "reset" | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (!kit) return null;

  const { days, days_available: total, replan } = kit.schedule;
  const fromDay = Math.max(1, Math.min(total, Math.trunc(Number(fromDayText)) || 1));
  const prompts = new Map(kit.questions.map((question) => [question.id, question.prompt]));
  const focus = new Set(replan?.focus_question_ids ?? []);
  const weakSpots = practice.data?.weak_spots ?? [];
  const totalMinutes = days.reduce((sum, day) => sum + day.minutes, 0);
  // Long schedules are grouped by week and only the first is open, so sixty days stay navigable on a phone.
  const weeks = Array.from({ length: Math.ceil(days.length / WEEK) }, (_, index) => days.slice(index * WEEK, (index + 1) * WEEK));

  async function run(which: "replan" | "reset", work: () => Promise<unknown>) {
    setBusy(which);
    setError(null);
    try {
      await work();
      await practice.mutate();
    } catch (failure) {
      setError(failure instanceof ApiError ? failure.message : "That did not work. Try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <Card className="p-5" aria-labelledby="weak-heading">
        <h2 id="weak-heading" className="text-lg font-semibold">
          Weak spots
        </h2>
        {weakSpots.length === 0 ? (
          <p className="mt-1 text-sm text-slate-600">None yet. Once practice shows which requirements you are unsure about, they appear here and you can re-plan your remaining days around them.</p>
        ) : (
          <>
            <p className="mt-1 text-sm text-slate-600">Requirements where your latest answer on a flashcard was &quot;no idea&quot; or &quot;shaky&quot;, must-haves first.</p>
            <ul className="mt-3 divide-y divide-slate-100">
              {weakSpots.map((spot) => (
                <li key={spot.requirement.id} className="flex flex-wrap items-baseline gap-x-2 gap-y-1 py-2 text-sm">
                  <Badge tone={spot.requirement.priority === "must" ? "red" : "neutral"}>{spot.requirement.priority === "must" ? "Must-have" : "Nice-to-have"}</Badge>
                  <span className="min-w-0 flex-1 font-medium text-slate-900">{spot.requirement.text}</span>
                  <span className="text-slate-600">
                    {spot.weakCards} of {spot.totalCards} card{spot.totalCards === 1 ? "" : "s"} shaky · {spot.questionIds.length} question{spot.questionIds.length === 1 ? "" : "s"} to revisit
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex flex-wrap items-end gap-3">
              <label className="text-sm font-medium text-slate-800">
                I am on day
                <input
                  type="number"
                  min={1}
                  max={total}
                  value={fromDayText}
                  onChange={(event) => setFromDayText(event.target.value)}
                  onBlur={() => setFromDayText(String(fromDay))}
                  className="ml-2 h-10 w-20 rounded-md border border-slate-300 px-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                />
              </label>
              <Button variant="primary" busy={busy === "replan"} onClick={() => void run("replan", () => actions.replan(fromDay))}>
                Re-plan from day {fromDay} around these
              </Button>
            </div>
            <p className="mt-2 text-sm text-slate-600">Days before that stay as they are. Everything else is dealt out again with these questions first.</p>
          </>
        )}
        {error && (
          <div className="mt-3">
            <Alert tone="error">{error}</Alert>
          </div>
        )}
      </Card>

      {replan && (
        <Alert tone="info" title={`Re-planned from day ${replan.from_day} around your weak spots`} action={<Button size="sm" busy={busy === "reset"} onClick={() => void run("reset", () => actions.regenerate({ section: "schedule" }))}>Back to the default plan</Button>}>
          Questions marked &quot;weak spot&quot; were moved to the front of the remaining days.
        </Alert>
      )}

      <section aria-labelledby="schedule-heading">
        <header className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="schedule-heading" className="text-lg font-semibold">
            {total}-day plan
          </h2>
          <p className="text-sm text-slate-600">
            {Math.floor(totalMinutes / 60)} h {totalMinutes % 60} min in total · harder and must-have material first
          </p>
        </header>
        <div className="space-y-3">
          {weeks.map((week, index) =>
            weeks.length === 1 ? (
              <DayList key={index} days={week} prompts={prompts} focus={focus} replanFrom={replan?.from_day} />
            ) : (
              <details key={index} open={index === 0} className="rounded-lg border border-slate-200 bg-white">
                <summary className="cursor-pointer rounded-lg px-4 py-3 font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600">
                  Days {week[0]!.day} to {week.at(-1)!.day}
                  <span className="ml-2 font-normal text-slate-600">{week.reduce((sum, day) => sum + day.minutes, 0)} min</span>
                </summary>
                <div className="border-t border-slate-100 p-3">
                  <DayList days={week} prompts={prompts} focus={focus} replanFrom={replan?.from_day} />
                </div>
              </details>
            ),
          )}
        </div>
      </section>
    </div>
  );
}

function DayList({ days, prompts, focus, replanFrom }: { days: ScheduleDay[]; prompts: Map<string, string>; focus: Set<string>; replanFrom?: number }) {
  return (
    <ol className="space-y-2">
      {days.map((day) => (
        <li key={day.day} className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="font-semibold text-slate-900">
              Day {day.day}
              {replanFrom !== undefined && day.day >= replanFrom && <span className="ml-2 text-xs font-normal text-indigo-700">re-planned</span>}
            </h3>
            <span className="text-sm text-slate-600">{day.minutes} min</span>
          </div>
          <p className="text-sm text-slate-700">{day.focus}</p>
          {day.question_ids.length > 0 && (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-800">
              {day.question_ids.map((id) => (
                <li key={id}>
                  {prompts.get(id) ?? id} {focus.has(id) && <Badge tone="amber">weak spot</Badge>}
                </li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ol>
  );
}
