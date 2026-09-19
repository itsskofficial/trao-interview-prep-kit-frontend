"use client";

import { useImperativeHandle, useRef, useState, type ReactNode, type Ref } from "react";
import { ApiError } from "@/lib/api";
import { Alert, Button } from "./primitives";

export interface ConfirmDialogHandle {
  open(): void;
}

interface ConfirmDialogProps {
  ref: Ref<ConfirmDialogHandle>;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  onConfirm(): Promise<unknown>;
}

/**
 * A confirmation built on the native dialog element: focus is trapped inside it, Escape closes
 * it, and focus returns to whatever opened it. The safe button has focus when it opens.
 */
export function ConfirmDialog({ ref, title, children, confirmLabel, danger, onConfirm }: ConfirmDialogProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useImperativeHandle(ref, () => ({ open: () => dialog.current?.showModal() }), []);

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
      dialog.current?.close();
    } catch (failure) {
      setError(failure instanceof ApiError ? failure.message : "That did not work. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <dialog ref={dialog} onClose={() => setError(null)} className="m-auto w-[min(26rem,calc(100vw-2rem))] rounded-2xl border border-slate-200 p-0 shadow-xl backdrop:bg-slate-900/40 backdrop:backdrop-blur-sm">
      <div className="space-y-4 p-5">
        <h2 className="text-lg font-semibold">{title}</h2>
        <div className="text-sm leading-relaxed text-slate-700">{children}</div>
        {error && <Alert tone="error">{error}</Alert>}
        <div className="flex justify-end gap-2">
          <Button autoFocus onClick={() => dialog.current?.close()}>
            Cancel
          </Button>
          <Button variant={danger ? "danger" : "primary"} busy={busy} onClick={() => void confirm()}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </dialog>
  );
}
