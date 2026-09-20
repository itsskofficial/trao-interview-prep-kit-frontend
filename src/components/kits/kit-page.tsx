"use client";

import clsx from "clsx";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useRef, useState, type KeyboardEvent } from "react";
import { ApiError } from "@/lib/api";
import { useKitEditor } from "@/lib/kit-editor";
import { CATEGORIES } from "@/lib/types";
import { api } from "@/lib/api";
import { ConfirmDialog, type ConfirmDialogHandle } from "../ui/confirm-dialog";
import { Alert, Button, Skeleton } from "../ui/primitives";
import { FlashcardsTab } from "./flashcards-tab";
import { OverviewTab } from "./overview-tab";
import { PracticeTab } from "./practice-tab";
import { SaveIndicator } from "./provenance";
import { QuestionsTab } from "./questions-tab";
import { ScheduleTab } from "./schedule-tab";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "questions", label: "Questions" },
  { id: "flashcards", label: "Flashcards" },
  { id: "schedule", label: "Schedule" },
  { id: "practice", label: "Practice" },
] as const;
type TabId = (typeof TABS)[number]["id"];

function Tile({ label, value, meter }: { label: string; value: string | number; meter?: number }) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white px-4 py-3 shadow-card">
      <dd className="text-2xl font-semibold tracking-tight text-slate-900">{value}</dd>
      <dt className="text-xs text-slate-600">{label}</dt>
      {meter !== undefined && (
        <div aria-hidden="true" className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-sky-400 transition-[width] duration-500" style={{ width: `${Math.round(meter * 100)}%` }} />
        </div>
      )}
    </div>
  );
}

export function KitPage({ id }: { id: string }) {
  const editor = useKitEditor(id);
  const { kit, stored, loadError, saveState, saveError, rejected, restored, actions } = editor;
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const deleteDialog = useRef<ConfirmDialogHandle>(null);
  const [undoing, setUndoing] = useState(false);
  const [undoError, setUndoError] = useState<string | null>(null);

  // The open tab lives in the URL, so a reload or a shared link lands in the same place.
  const requested = params.get("tab");
  const active: TabId = TABS.some((tab) => tab.id === requested) ? (requested as TabId) : "overview";
  const select = (tab: TabId) => router.replace(tab === "overview" ? pathname : `${pathname}?tab=${tab}`, { scroll: false });

  function onTabKey(event: KeyboardEvent) {
    const index = TABS.findIndex((tab) => tab.id === active);
    const next = event.key === "ArrowRight" ? index + 1 : event.key === "ArrowLeft" ? index - 1 : event.key === "Home" ? 0 : event.key === "End" ? TABS.length - 1 : null;
    if (next === null) return;
    event.preventDefault();
    const target = TABS[(next + TABS.length) % TABS.length]!;
    select(target.id);
    tabRefs.current[target.id]?.focus();
  }

  async function undo() {
    setUndoing(true);
    setUndoError(null);
    try {
      await actions.undoRegeneration();
    } catch (failure) {
      setUndoError(failure instanceof ApiError ? failure.message : "Could not undo.");
    } finally {
      setUndoing(false);
    }
  }

  if (loadError && !kit) {
    return (
      <Alert tone="error" title={loadError.status === 404 ? "This kit does not exist" : "Could not load this kit"} action={loadError.status === 404 ? undefined : <Button size="sm" onClick={actions.reload}>Try again</Button>}>
        {loadError.status === 404 ? <Link href="/" className="underline">Back to my kits</Link> : loadError.message}
      </Alert>
    );
  }
  if (!kit || !stored) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Loading kit">
        <Skeleton className="h-9 w-2/3" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  const regeneration = stored.regeneration;
  const sectionName = (target: NonNullable<typeof stored.undoable>) =>
    target.section === "brief" ? "the company brief" : `the ${CATEGORIES.find((category) => category.id === target.category)?.label.toLowerCase()} questions`;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">{kit.source.role || "Untitled role"}</h1>
          <p className="text-slate-600">
            {kit.source.company || "Company not identified"} · {kit.schedule.days_available}-day plan
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 print:hidden">
          <SaveIndicator state={saveState} error={saveError} onRetry={actions.retrySave} />
          <a href={`/api/kits/${id}/export`} download className="inline-flex min-h-8 items-center rounded-lg border border-slate-200 bg-white px-2.5 text-sm font-medium text-slate-800 shadow-sm hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600">
            Download JSON
          </a>
          <Button size="sm" variant="danger" onClick={() => deleteDialog.current?.open()}>
            Delete
          </Button>
          <Link href={`/kits/${id}/print`} className="inline-flex min-h-8 items-center rounded-md border border-slate-300 bg-white px-2.5 text-sm font-medium text-slate-800 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600">
            One-page summary
          </Link>
        </div>
      </header>

      <ConfirmDialog
        ref={deleteDialog}
        title="Delete this kit?"
        confirmLabel="Delete kit"
        danger
        onConfirm={async () => {
          await api(`/kits/${id}`, { method: "DELETE" });
          router.push("/");
        }}
      >
        <strong className="font-semibold">{kit.source.role || "This kit"}</strong>
        {kit.source.company ? ` at ${kit.source.company}` : ""}, with your edits and your practice progress, will be deleted for good.
      </ConfirmDialog>

      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4 print:hidden">
        <Tile label="Must-have requirements" value={kit.role.requirements.filter((requirement) => requirement.priority === "must").length} />
        <Tile label="Questions" value={kit.questions.length} />
        <Tile label="Flashcards" value={kit.flashcards.length} />
        <Tile
          label="Requirements covered"
          value={`${kit.role.requirements.length - kit.coverage.uncovered_requirement_ids.length} / ${kit.role.requirements.length}`}
          meter={kit.role.requirements.length === 0 ? 0 : 1 - kit.coverage.uncovered_requirement_ids.length / kit.role.requirements.length}
        />
      </dl>

      {restored > 0 && (
        <Alert tone="info" title={restored === 1 ? "One unsaved change was recovered" : `${restored} unsaved changes were recovered`} action={<Button size="sm" onClick={actions.dismissRestored}>Dismiss</Button>}>
          {restored === 1 ? "It was" : "They were"} made on your last visit and never reached the server, so {restored === 1 ? "it has" : "they have"} been applied and sent now.
        </Alert>
      )}
      {rejected && (
        <Alert tone="warning" title="One change could not be saved" action={<Button size="sm" onClick={actions.dismissRejected}>Dismiss</Button>}>
          {rejected} The kit has been refreshed.
        </Alert>
      )}
      {regeneration?.status === "failed" && (
        <Alert tone="error" title={`Regenerating ${sectionName(regeneration)} did not work`}>
          {regeneration.error ?? "Something went wrong."} Nothing in your kit was changed.
        </Alert>
      )}
      {stored.undoable && regeneration?.status !== "running" && (
        <Alert tone="success" title={`Regenerated ${sectionName(stored.undoable)}`} action={<Button size="sm" busy={undoing} onClick={() => void undo()}>Undo</Button>}>
          Everything you wrote, edited or pinned was kept. {undoError}
        </Alert>
      )}

      <div role="tablist" aria-label="Kit sections" onKeyDown={onTabKey} className="sticky top-[57px] z-20 -mx-4 flex gap-1 overflow-x-auto border-b border-slate-200 bg-slate-50/85 px-4 backdrop-blur-md print:hidden sm:mx-0 sm:rounded-t-xl sm:px-1">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            ref={(element) => void (tabRefs.current[tab.id] = element)}
            role="tab"
            type="button"
            id={`tab-${tab.id}`}
            aria-selected={active === tab.id}
            aria-controls={`panel-${tab.id}`}
            tabIndex={active === tab.id ? 0 : -1}
            onClick={() => select(tab.id)}
            className={clsx(
              "-mb-px shrink-0 border-b-2 px-3 py-2.5 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-indigo-600",
              active === tab.id ? "border-indigo-600 text-indigo-700" : "border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-900",
            )}
          >
            {tab.label}
            {tab.id === "questions" && <span className="ml-1.5 text-slate-500">{kit.questions.length}</span>}
            {tab.id === "flashcards" && <span className="ml-1.5 text-slate-500">{kit.flashcards.length}</span>}
          </button>
        ))}
      </div>

      <div key={active} role="tabpanel" id={`panel-${active}`} aria-labelledby={`tab-${active}`} tabIndex={-1} className="animate-rise">
        {active === "overview" && <OverviewTab editor={editor} />}
        {active === "questions" && <QuestionsTab editor={editor} />}
        {active === "flashcards" && <FlashcardsTab editor={editor} />}
        {active === "schedule" && <ScheduleTab kitId={id} editor={editor} />}
        {active === "practice" && <PracticeTab kitId={id} kit={kit} />}
      </div>
    </div>
  );
}
