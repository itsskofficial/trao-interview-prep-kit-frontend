"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { ApiError } from "@/lib/api";
import { Alert, Button } from "../ui/primitives";

interface RegenerateButtonProps {
  /** What is being regenerated, as it reads in a sentence: "the technical questions". */
  what: string;
  label?: string;
  /** How many items will be replaced and how many are protected and stay. */
  replace: number;
  keep: number;
  /** Shown when there is something the user should know before going ahead. */
  warning?: ReactNode;
  disabled?: boolean;
  disabledReason?: string;
  onConfirm(): Promise<unknown>;
}

/**
 * Regenerating is never one click away from losing work: the dialog says how many items will be
 * replaced and how many are kept, and the default button is the safe one.
 */
export function RegenerateButton({ what, label = "Regenerate", replace, keep, warning, disabled, disabledReason, onConfirm }: RegenerateButtonProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const reasonId = useId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
      dialog.current?.close();
    } catch (failure) {
      setError(failure instanceof ApiError ? failure.message : "Could not start. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {disabled && disabledReason && (
        <span id={reasonId} className="sr-only">
          {disabledReason}
        </span>
      )}
      <Button size="sm" disabled={disabled} title={disabled ? disabledReason : undefined} aria-describedby={disabled && disabledReason ? reasonId : undefined} onClick={() => dialog.current?.showModal()}>
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 12a9 9 0 1 1-3-6.7M21 4v5h-5" />
        </svg>
        {label}
      </Button>

      {/* A native dialog: focus is trapped, Escape closes it, and focus returns to the button. */}
      <dialog ref={dialog} className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-lg border border-slate-200 p-0 shadow-xl backdrop:bg-slate-900/40" onClose={() => setError(null)}>
        <div className="space-y-4 p-5">
          <h2 className="text-lg font-semibold">Regenerate {what}?</h2>
          <ul className="space-y-1 text-sm text-slate-700">
            <li>
              <strong className="font-semibold">{replace}</strong> generated item{replace === 1 ? "" : "s"} will be replaced.
            </li>
            <li>
              <strong className="font-semibold">{keep}</strong> item{keep === 1 ? "" : "s"} you wrote, edited or pinned will be kept, in place.
            </li>
            <li>Every other section stays exactly as it is, and you can keep editing while this runs.</li>
            <li>You can undo it afterwards.</li>
          </ul>
          {warning}
          {error && <Alert tone="error">{error}</Alert>}
          <div className="flex justify-end gap-2">
            <Button autoFocus onClick={() => dialog.current?.close()}>
              Cancel
            </Button>
            <Button variant="primary" busy={busy} onClick={() => void confirm()}>
              Regenerate
            </Button>
          </div>
        </div>
      </dialog>
    </>
  );
}

/** Deleting is instant, and for a few seconds it can be taken back. */
export function UndoToast({ message, onUndo, onDone, paused, onPauseChange }: { message: string; onUndo(): void; onDone(): void; paused?: boolean; onPauseChange?(paused: boolean): void }) {
  useEffect(() => {
    if (paused) return;
    const timer = setTimeout(onDone, 6_000);
    return () => clearTimeout(timer);
  }, [onDone, paused]);

  return (
    <div role="status" className="fixed inset-x-4 bottom-4 z-40 mx-auto flex max-w-md items-center justify-between gap-3 rounded-lg bg-slate-900 px-4 py-3 text-sm text-white shadow-lg print:hidden">
      <span>{message}</span>
      {/* Deleting removed the button that had focus. Focus comes here, and the countdown waits while it stays. */}
      <button type="button" autoFocus onFocus={() => onPauseChange?.(true)} onBlur={() => onPauseChange?.(false)} onClick={onUndo} className="rounded px-2 py-1 font-semibold text-indigo-200 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-white">
        Undo
      </button>
    </div>
  );
}
