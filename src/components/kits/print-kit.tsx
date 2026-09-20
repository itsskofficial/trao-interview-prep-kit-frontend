"use client";

import Link from "next/link";
import useSWR from "swr";
import { fetcher, type ApiError } from "@/lib/api";
import { CATEGORIES, type Question, type StoredKit } from "@/lib/types";
import { Alert, Button, Skeleton } from "../ui/primitives";

const PER_CATEGORY = 4;

/** Must-have questions first, then the harder ones: the same priority the schedule uses. */
function topQuestions(questions: Question[], mustIds: Set<string>): Question[] {
  const coversMust = (question: Question) => question.requirement_ids.some((id) => mustIds.has(id));
  return [...questions].sort((a, b) => Number(coversMust(b)) - Number(coversMust(a)) || b.difficulty - a.difficulty).slice(0, PER_CATEGORY);
}

/**
 * The night-before sheet: the kit as the user has shaped it, laid out for A4 with nothing on it
 * that is not worth re-reading. Printing, or "Save as PDF", is the browser's own.
 */
export function PrintKit({ id }: { id: string }) {
  const { data, error, isLoading, mutate } = useSWR<StoredKit, ApiError>(`/kits/${id}`, fetcher, { revalidateOnFocus: false });

  if (isLoading) return <div className="mx-auto max-w-3xl p-6"><Skeleton className="h-96 w-full" /></div>;
  if (error || !data) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <Alert tone="error" title="Could not load this kit" action={<Button size="sm" onClick={() => void mutate()}>Try again</Button>}>
          {error?.message}
        </Alert>
      </div>
    );
  }

  const { kit } = data;
  const must = kit.role.requirements.filter((requirement) => requirement.priority === "must");
  const nice = kit.role.requirements.filter((requirement) => requirement.priority === "nice");
  const mustIds = new Set(must.map((requirement) => requirement.id));
  const prompts = new Map(kit.questions.map((question) => [question.id, question.prompt]));

  return (
    <main id="main" className="mx-auto max-w-3xl bg-surface px-6 py-6 text-[13px] leading-snug text-slate-900 print:max-w-none print:p-0">
      <div className="mb-4 flex items-center justify-between gap-3 print:hidden">
        <Link href={`/kits/${id}`} className="text-sm font-medium text-indigo-700 underline underline-offset-2">
          Back to the kit
        </Link>
        <Button variant="primary" onClick={() => window.print()}>
          Print or save as PDF
        </Button>
      </div>

      <header className="border-b border-slate-300 pb-2">
        <h1 className="text-xl font-semibold">{kit.source.role || "Interview prep"}</h1>
        <p className="text-slate-700">
          {[kit.source.company, kit.role.seniority, kit.source.location].filter(Boolean).join(" · ")}
        </p>
      </header>

      <Section title="The company">
        <p>{kit.company_brief.summary}</p>
        {kit.company_brief.what_they_do && <p className="mt-1">{kit.company_brief.what_they_do}</p>}
      </Section>

      {(kit.hiring_stages ?? []).length > 0 && (
        <Section title="Their interview process">
          <ol className="list-decimal pl-5">
            {kit.hiring_stages!.map((stage) => (
              <li key={stage}>{stage}</li>
            ))}
          </ol>
        </Section>
      )}

      <Section title="What they are asking for">
        {must.length === 0 && nice.length === 0 && <p>The posting states no requirements.</p>}
        {must.length > 0 && (
          <p>
            <strong>Must have:</strong> {must.map((requirement) => requirement.text).join("; ")}.
          </p>
        )}
        {nice.length > 0 && (
          <p className="mt-1">
            <strong>Nice to have:</strong> {nice.map((requirement) => requirement.text).join("; ")}.
          </p>
        )}
      </Section>

      {CATEGORIES.map(({ id: category, label }) => {
        const questions = topQuestions(kit.questions.filter((question) => question.category === category), mustIds);
        if (questions.length === 0) return null;
        return (
          <Section key={category} title={`${label} questions`}>
            <ol className="list-decimal space-y-1.5 pl-5">
              {questions.map((question) => (
                <li key={question.id} className="break-inside-avoid">
                  <span className="font-medium">{question.prompt}</span>
                  {question.answer_outline && <span className="block text-slate-700">{question.answer_outline}</span>}
                </li>
              ))}
            </ol>
          </Section>
        );
      })}

      <Section title={`${kit.schedule.days_available}-day plan`}>
        <ol className="space-y-0.5">
          {kit.schedule.days.slice(0, 14).map((day) => (
            <li key={day.day} className="break-inside-avoid">
              <strong>Day {day.day}</strong> ({day.minutes} min): {day.focus}
              {day.question_ids.length > 0 && <span className="text-slate-600"> · {day.question_ids.length} question{day.question_ids.length === 1 ? "" : "s"}, starting with &quot;{(prompts.get(day.question_ids[0]!) ?? "").slice(0, 70)}...&quot;</span>}
            </li>
          ))}
        </ol>
        {kit.schedule.days.length > 14 && <p className="mt-1 text-slate-600">...and {kit.schedule.days.length - 14} more days in the app.</p>}
      </Section>

      {(kit.notes ?? []).length > 0 && (
        <Section title="What this kit could not find">
          <ul className="list-disc pl-5">
            {kit.notes!.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </Section>
      )}
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-3 break-inside-avoid-page">
      <h2 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-600">{title}</h2>
      {children}
    </section>
  );
}
