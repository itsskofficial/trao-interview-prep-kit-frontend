"use client";

import { arrayMove } from "@dnd-kit/sortable";
import { useState, type FormEvent } from "react";
import { ApiError } from "@/lib/api";
import type { KitEditor } from "@/lib/kit-editor";
import { Alert, Button, Card, EmptyState, Field, Input, Textarea } from "../ui/primitives";
import { EditableText } from "./editable-text";
import { PinButton, ProvenanceBadges } from "./provenance";
import { IconButton } from "./question-list";

export function FlashcardsTab({ editor }: { editor: KitEditor }) {
  const { kit, actions } = editor;
  if (!kit) return null;
  const ids = kit.flashcards.map((card) => card.id);

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">Click a card&apos;s text to edit it. Use Practice to work through them one at a time.</p>

      {kit.flashcards.length === 0 ? (
        <EmptyState title="No flashcards yet">The posting gave too little to write cards from. Add your own below.</EmptyState>
      ) : (
        <ol className="grid gap-3 sm:grid-cols-2">
          {kit.flashcards.map((card, index) => {
            const name = `flashcard ${index + 1} of ${kit.flashcards.length}`;
            return (
              <li key={card.id}>
                <Card className="flex h-full flex-col p-4">
                  <EditableText label={`Front of ${name}`} value={card.front} maxLength={500} onChange={(front) => actions.editFlashcard(card.id, { front })} className="font-medium text-slate-900" />
                  <EditableText label={`Back of ${name}`} value={card.back} maxLength={3000} placeholder="The answer..." onChange={(back) => actions.editFlashcard(card.id, { back })} className="text-sm text-slate-700" />
                  <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-3">
                    <ProvenanceBadges item={card} />
                    <span className="flex items-center gap-0.5">
                      <IconButton label={`Move ${name} earlier`} disabled={index === 0} onClick={() => actions.reorderFlashcards(arrayMove(ids, index, index - 1))} path="M15 6l-6 6 6 6" />
                      <IconButton label={`Move ${name} later`} disabled={index === ids.length - 1} onClick={() => actions.reorderFlashcards(arrayMove(ids, index, index + 1))} path="M9 6l6 6-6 6" />
                      <PinButton pinned={Boolean(card.pinned)} what={name} onToggle={() => actions.pin({ kind: "flashcard", id: card.id }, !card.pinned)} />
                      <IconButton label={`Delete ${name}`} danger onClick={() => actions.deleteFlashcard(card.id)} path="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
                    </span>
                  </div>
                </Card>
              </li>
            );
          })}
        </ol>
      )}
      <AddFlashcard onAdd={actions.addFlashcard} />
    </div>
  );
}

function AddFlashcard({ onAdd }: { onAdd: KitEditor["actions"]["addFlashcard"] }) {
  const [open, setOpen] = useState(false);
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onAdd({ front, back });
      setFront("");
      setBack("");
      setOpen(false);
    } catch (failure) {
      setError(failure instanceof ApiError ? failure : new ApiError(0, "UNKNOWN", "Could not add the card."));
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>
        + Add a flashcard
      </Button>
    );
  }
  return (
    <Card className="p-4">
      <form onSubmit={submit} className="space-y-3">
        {error && Object.keys(error.fields).length === 0 && <Alert tone="error">{error.message}</Alert>}
        <Field id="new-card-front" label="Front" error={error?.fields.front}>
          {(props) => <Input {...props} autoFocus required maxLength={500} value={front} onChange={(e) => setFront(e.target.value)} />}
        </Field>
        <Field id="new-card-back" label="Back" error={error?.fields.back}>
          {(props) => <Textarea {...props} rows={3} maxLength={3000} value={back} onChange={(e) => setBack(e.target.value)} />}
        </Field>
        <div className="flex gap-2">
          <Button type="submit" variant="primary" size="sm" busy={busy} disabled={front.trim().length === 0}>
            Add flashcard
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
        </div>
      </form>
    </Card>
  );
}
