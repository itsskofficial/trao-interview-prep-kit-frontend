"use client";

import clsx from "clsx";
import { isProtected, type Provenance } from "@/lib/types";
import type { SaveState } from "@/lib/save-queue";
import { Badge, Button, Spinner } from "../ui/primitives";

/** Says at a glance what a regeneration would do to this item. */
export function ProvenanceBadges({ item }: { item: Provenance }) {
  return (
    <span className="inline-flex flex-wrap gap-1">
      {item.origin === "user" && <Badge tone="violet" title="You wrote this. Regenerating never touches it.">Yours</Badge>}
      {item.origin === "fallback" && <Badge tone="amber" title="Written by the app because the model left a must-have requirement uncovered.">Written by the app</Badge>}
      {item.edited && item.origin !== "user" && <Badge tone="indigo" title="You edited this. Regenerating never touches it.">Edited</Badge>}
      {item.pinned && <Badge tone="emerald" title="Pinned. Regenerating never touches it.">Pinned</Badge>}
      {!isProtected(item) && <Badge title="Generated and untouched. Regenerating this section replaces it.">Generated</Badge>}
    </span>
  );
}

export function PinButton({ pinned, onToggle, what }: { pinned: boolean; onToggle(): void; what: string }) {
  return (
    <button
      type="button"
      aria-pressed={pinned}
      aria-label={pinned ? `Unpin ${what}` : `Pin ${what} so regenerating keeps it`}
      title={pinned ? "Unpin" : "Pin: keep this when regenerating"}
      onClick={onToggle}
      className={clsx(
        "inline-flex h-8 w-8 items-center justify-center rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600",
        pinned ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100" : "text-slate-500 hover:bg-slate-100 hover:text-slate-800",
      )}
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill={pinned ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true">
        <path d="M9 3h6l-1 6 4 4v2h-5v6l-1 1-1-1v-6H6v-2l4-4-1-6z" />
      </svg>
    </button>
  );
}

const SAVE_COPY: Record<SaveState, string> = { saved: "All changes saved", saving: "Saving...", unsaved: "Saving...", failed: "Not saved" };

/** Always visible while editing, so "did that save?" never has to be asked. */
export function SaveIndicator({ state, error, onRetry }: { state: SaveState; error: string | null; onRetry(): void }) {
  return (
    <div role="status" className={clsx("flex items-center gap-2 text-sm", state === "failed" ? "text-red-700" : "text-slate-600")}>
      {(state === "saving" || state === "unsaved") && <Spinner className="h-4 w-4" />}
      {state === "saved" && (
        <svg viewBox="0 0 24 24" className="h-4 w-4 text-emerald-600" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M5 13l4 4L19 7" />
        </svg>
      )}
      <span>
        {SAVE_COPY[state]}
        {state === "failed" && error ? `: ${error}` : ""}
      </span>
      {state === "failed" && (
        <Button size="sm" onClick={onRetry}>
          Retry
        </Button>
      )}
    </div>
  );
}
