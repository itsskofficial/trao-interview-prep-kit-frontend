"use client";

import type { KitEditor } from "@/lib/kit-editor";
import { isProtected, type ResearchLogEntry } from "@/lib/types";
import { usePathname } from "next/navigation";
import { Alert, Badge, Card, Spinner } from "../ui/primitives";
import { CoverageMap } from "./coverage-map";
import { EditableText } from "./editable-text";
import { PinButton, ProvenanceBadges } from "./provenance";
import { RegenerateButton } from "./regenerate";

const OUTCOME_TONE: Record<ResearchLogEntry["outcome"], "emerald" | "neutral" | "amber" | "red"> = { used: "emerald", empty: "neutral", skipped: "amber", failed: "red" };
const SOURCE_LABEL: Record<string, string> = {
  "company-site": "Company site",
  "hiring-page": "Hiring process page",
  sitemap: "Sitemap",
  "hacker-news": "Hacker News",
  "stack-exchange-workplace": "Stack Exchange Workplace",
  "public-discussion": "Public discussion",
};

export function OverviewTab({ editor }: { editor: KitEditor }) {
  const { kit, stored, actions } = editor;
  const pathname = usePathname();
  if (!kit) return null;

  const brief = kit.company_brief;
  const running = stored?.regeneration?.status === "running" ? stored.regeneration : null;
  const briefRegenerating = running?.section === "brief";
  const uncovered = kit.role.requirements.filter((requirement) => kit.coverage.uncovered_requirement_ids.includes(requirement.id));
  const questionCount = (requirementId: string) => kit.questions.filter((question) => question.requirement_ids.includes(requirementId)).length;

  return (
    <div className="space-y-6">
      {(kit.notes ?? []).length > 0 && (
        <Alert tone="warning" title="What this kit could not find">
          <ul className="list-disc space-y-1 pl-5">
            {kit.notes!.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </Alert>
      )}

      <Card className="p-5" aria-labelledby="brief-heading">
        <header className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="brief-heading" className="text-lg font-semibold">
            Company brief
          </h2>
          <div className="flex items-center gap-1">
            {briefRegenerating && <Spinner className="h-4 w-4 text-indigo-600" label="Re-reading the company site..." />}
            <PinButton pinned={Boolean(brief.pinned)} what="the company brief" onToggle={() => actions.pin({ kind: "brief" }, !brief.pinned)} />
            <RegenerateButton
              what="the company brief"
              replace={isProtected(brief) ? 0 : 1}
              keep={isProtected(brief) ? 1 : 0}
              disabled={Boolean(running)}
              disabledReason="Another section is being regenerated."
              warning={
                isProtected(brief) ? (
                  <Alert tone="warning" title="You have edited or pinned this brief">
                    Regenerating will replace your text with a new brief. You can undo it afterwards.
                  </Alert>
                ) : undefined
              }
              onConfirm={() => actions.regenerate({ section: "brief", force: isProtected(brief) })}
            />
          </div>
        </header>
        <div className="mt-1">
          <ProvenanceBadges item={brief} />
        </div>

        <h3 className="mt-4 text-sm font-semibold text-slate-700">Summary</h3>
        <EditableText label="Company summary" value={brief.summary} maxLength={4000} onChange={(summary) => actions.editBrief({ summary })} />
        <h3 className="mt-3 text-sm font-semibold text-slate-700">What they do</h3>
        <EditableText label="What the company does" value={brief.what_they_do} maxLength={4000} placeholder="Add your own notes..." onChange={(what_they_do) => actions.editBrief({ what_they_do })} />

        {(kit.hiring_stages ?? []).length > 0 && (
          <>
            <h3 className="mt-4 text-sm font-semibold text-slate-700">How they hire, as published on their site</h3>
            <ol className="mt-1 list-decimal space-y-0.5 pl-5 text-slate-800">
              {kit.hiring_stages!.map((stage) => (
                <li key={stage}>{stage}</li>
              ))}
            </ol>
          </>
        )}
        {(kit.interview_insights ?? []).length > 0 && (
          <>
            <h3 className="mt-4 text-sm font-semibold text-slate-700">What people say about interviewing there</h3>
            <ul className="mt-1 list-disc space-y-0.5 pl-5 text-slate-800">
              {kit.interview_insights!.map((insight) => (
                <li key={insight}>{insight}</li>
              ))}
            </ul>
          </>
        )}
        {brief.sources.length > 0 && (
          <p className="mt-4 text-sm text-slate-600">
            Sources:{" "}
            {brief.sources.map((url, index) => (
              <span key={url}>
                {index > 0 && ", "}
                <a href={url} target="_blank" rel="noreferrer noopener" className="break-all text-indigo-700 underline underline-offset-2">
                  {new URL(url).pathname === "/" ? new URL(url).host : `${new URL(url).host}${new URL(url).pathname}`}
                </a>
              </span>
            ))}
          </p>
        )}
      </Card>

      <Card className="p-5" aria-labelledby="role-heading">
        <h2 id="role-heading" className="text-lg font-semibold">
          {kit.role.title || "Role"}
        </h2>
        <p className="text-sm text-slate-600">{[kit.role.seniority, kit.source.location].filter(Boolean).join(" · ") || "Seniority and location are not stated in the posting."}</p>

        <h3 className="mt-4 text-sm font-semibold text-slate-700">Requirements, taken only from the posting</h3>
        {kit.role.requirements.length === 0 ? (
          <p className="mt-1 text-sm text-slate-600">The posting states no requirements. Nothing was invented to fill the gap.</p>
        ) : (
          <ul className="mt-2 divide-y divide-slate-100">
            {kit.role.requirements.map((requirement) => (
              <li key={requirement.id} className="flex flex-wrap items-baseline gap-x-2 gap-y-1 py-2">
                <span className="font-mono text-xs text-slate-500">{requirement.id}</span>
                <span className="min-w-0 flex-1 text-slate-900" title={requirement.evidence ? `From the posting: "${requirement.evidence}"` : undefined}>
                  {requirement.text}
                </span>
                <Badge tone={requirement.priority === "must" ? "red" : "neutral"}>{requirement.priority === "must" ? "Must-have" : "Nice-to-have"}</Badge>
                <Badge>{requirement.kind}</Badge>
                <span className="text-xs text-slate-600">
                  {questionCount(requirement.id)} question{questionCount(requirement.id) === 1 ? "" : "s"}
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-sm text-slate-600">
          Coverage was checked {kit.coverage.passes} time{kit.coverage.passes === 1 ? "" : "s"}.{" "}
          {uncovered.length === 0 ? "Every requirement has at least one question." : `No question yet for: ${uncovered.map((requirement) => requirement.text).join("; ")}.`}
        </p>

        {kit.role.responsibilities.length > 0 && (
          <>
            <h3 className="mt-4 text-sm font-semibold text-slate-700">Responsibilities</h3>
            <ul className="mt-1 list-disc space-y-0.5 pl-5 text-slate-800">
              {kit.role.responsibilities.map((responsibility) => (
                <li key={responsibility}>{responsibility}</li>
              ))}
            </ul>
          </>
        )}
      </Card>

      <CoverageMap kit={kit} kitPath={pathname} />

      <Card className="p-5" aria-labelledby="research-heading">
        <h2 id="research-heading" className="text-lg font-semibold">
          Research log
        </h2>
        <p className="text-sm text-slate-600">Every source the app tried, and what came of it.</p>
        <ul className="mt-3 divide-y divide-slate-100 text-sm">
          {(kit.research_log ?? []).map((entry, index) => (
            <li key={index} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 py-2">
              <Badge tone={OUTCOME_TONE[entry.outcome]}>{entry.outcome}</Badge>
              <span className="font-medium text-slate-900">{SOURCE_LABEL[entry.source] ?? entry.source}</span>
              {entry.url && <span className="break-all text-slate-600">{entry.url}</span>}
              {entry.reason && <span className="w-full text-slate-600">{entry.reason}</span>}
            </li>
          ))}
          {(kit.research_log ?? []).length === 0 && <li className="py-2 text-slate-600">No research was recorded for this kit.</li>}
        </ul>
      </Card>
    </div>
  );
}
