import Link from "next/link";
import type { Kit } from "@/lib/types";
import { Badge, Card } from "../ui/primitives";

/**
 * Coverage made visible: every requirement the posting states, against the questions and
 * flashcards that cover it. It is the same check the backend runs in code, so an uncovered
 * requirement here is exactly what the generation loop would have gone back for.
 */
export function CoverageMap({ kit, kitPath }: { kit: Kit; kitPath: string }) {
  const requirements = [...kit.role.requirements].sort((a, b) => Number(b.priority === "must") - Number(a.priority === "must"));
  if (requirements.length === 0) return null;
  const covered = requirements.filter((requirement) => kit.questions.some((question) => question.requirement_ids.includes(requirement.id))).length;

  return (
    <Card className="p-5" aria-labelledby="coverage-heading">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="coverage-heading" className="text-lg font-semibold">
          Coverage map
        </h2>
        <p className="text-sm text-slate-600">
          {covered} of {requirements.length} requirements have a question · checked {kit.coverage.passes} time{kit.coverage.passes === 1 ? "" : "s"} during generation
        </p>
      </header>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[34rem] border-collapse text-left text-sm">
          <caption className="sr-only">Each requirement from the posting, with the questions and flashcards that cover it.</caption>
          <thead>
            <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
              <th scope="col" className="py-2 pr-3 font-semibold">Requirement</th>
              <th scope="col" className="py-2 pr-3 font-semibold">Questions</th>
              <th scope="col" className="py-2 font-semibold">Flashcards</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {requirements.map((requirement) => {
              const questions = kit.questions.filter((question) => question.requirement_ids.includes(requirement.id));
              const cards = kit.flashcards.filter((card) => card.requirement_ids.includes(requirement.id)).length;
              const uncovered = questions.length === 0;
              return (
                <tr key={requirement.id} className={uncovered ? "bg-red-50/70" : undefined}>
                  <th scope="row" className="max-w-[18rem] py-2.5 pr-3 align-top font-normal">
                    <span className="mr-1.5 font-mono text-xs text-slate-500">{requirement.id}</span>
                    <span className="text-slate-900">{requirement.text}</span>{" "}
                    <Badge tone={requirement.priority === "must" ? "red" : "neutral"}>{requirement.priority === "must" ? "Must-have" : "Nice-to-have"}</Badge>
                  </th>
                  <td className="py-2.5 pr-3 align-top">
                    {uncovered ? (
                      <span className="font-medium text-red-800">No question yet</span>
                    ) : (
                      <span className="flex flex-wrap gap-1">
                        {questions.map((question) => (
                          <Link
                            key={question.id}
                            href={`${kitPath}?tab=questions#question-${question.id}`}
                            title={question.prompt}
                            className="rounded-full bg-indigo-50 px-2 py-0.5 font-mono text-xs font-medium text-indigo-700 ring-1 ring-inset ring-indigo-100 hover:bg-indigo-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-indigo-600"
                          >
                            {question.id}
                            <span className="sr-only">: {question.prompt}</span>
                          </Link>
                        ))}
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 align-top text-slate-700">{cards === 0 ? <span className="text-slate-500">none</span> : cards}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
