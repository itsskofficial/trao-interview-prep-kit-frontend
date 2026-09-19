"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { ApiError } from "@/lib/api";
import type { KitEditor } from "@/lib/kit-editor";
import { CATEGORIES, isProtected, type Question, type QuestionCategory } from "@/lib/types";
import { Alert, Button, Card, EmptyState, Field, Input, Spinner, Textarea } from "../ui/primitives";
import { QuestionList } from "./question-list";
import { RegenerateButton, UndoToast } from "./regenerate";

const UNDO_WINDOW_MS = 6_000;

/**
 * Deleting hides the question at once and tells the server a few seconds later, so "Undo" is
 * simply not sending it. Leaving the page sends whatever is still pending.
 */
function useDeferredDelete(commit: (id: string) => void) {
  const [pending, setPending] = useState<Question | null>(null);
  const waiting = useRef<{ question: Question; timer: ReturnType<typeof setTimeout> } | null>(null);

  /** Sends the delete that is waiting, if there is one. */
  const flush = useCallback(() => {
    if (!waiting.current) return;
    clearTimeout(waiting.current.timer);
    commit(waiting.current.question.id);
    waiting.current = null;
  }, [commit]);

  const remove = useCallback(
    (question: Question) => {
      flush(); // a second delete settles the first
      const timer = setTimeout(() => {
        flush();
        setPending(null);
      }, UNDO_WINDOW_MS);
      waiting.current = { question, timer };
      setPending(question);
    },
    [flush],
  );

  const undo = useCallback(() => {
    if (waiting.current) clearTimeout(waiting.current.timer);
    waiting.current = null;
    setPending(null);
  }, []);

  // Switching tab or leaving the page inside the undo window still deletes.
  useEffect(() => flush, [flush]);

  return { hiddenId: pending?.id, pending, remove, undo, settle: useCallback(() => setPending(null), []) };
}

export function QuestionsTab({ editor }: { editor: KitEditor }) {
  const { kit, stored, actions } = editor;
  const deletion = useDeferredDelete(actions.deleteQuestion);
  if (!kit) return null;

  const running = stored?.regeneration?.status === "running" ? stored.regeneration : null;
  const companyKnown = kit.company_brief.sources.length > 0;

  return (
    <div className="space-y-8">
      <p className="text-sm text-slate-600">
        Click any text to edit it. Drag the handle, or focus it and use Space and the arrow keys, to reorder. Anything you write, edit or pin is kept when you regenerate a category.
      </p>

      {CATEGORIES.map(({ id: category, label }) => {
        const questions = kit.questions.filter((question) => question.category === category && question.id !== deletion.hiddenId);
        const keep = questions.filter(isProtected).length;
        const regenerating = running?.section === "questions" && running.category === category;
        const blocked = category === "company-fit" && !companyKnown;

        return (
          <section key={category} aria-labelledby={`category-${category}`}>
            <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 id={`category-${category}`} className="text-lg font-semibold">
                {label} <span className="font-normal text-slate-500">({questions.length})</span>
              </h2>
              <div className="flex items-center gap-2">
                {regenerating && <Spinner className="h-4 w-4 text-indigo-600" label="Regenerating..." />}
                <RegenerateButton
                  what={`the ${label.toLowerCase()} questions`}
                  replace={questions.length - keep}
                  keep={keep}
                  disabled={Boolean(running) || blocked}
                  disabledReason={blocked ? "Nothing is known about the company, so company-fit questions cannot be generated honestly." : "Another section is being regenerated."}
                  onConfirm={() => actions.regenerate({ section: "questions", category })}
                />
              </div>
            </header>

            {questions.length === 0 ? (
              <EmptyState title={`No ${label.toLowerCase()} questions`}>
                {blocked ? "Nothing about the company could be retrieved, so none were generated. You can still add your own." : "Add your own below, or regenerate this category."}
              </EmptyState>
            ) : (
              <QuestionList category={category} questions={questions} requirements={kit.role.requirements} actions={actions} regenerating={regenerating} onDelete={deletion.remove} />
            )}
            <AddQuestion category={category} label={label} onAdd={actions.addQuestion} />
          </section>
        );
      })}

      {deletion.pending && <UndoToast key={deletion.pending.id} message="Question deleted." onUndo={deletion.undo} onDone={deletion.settle} />}
    </div>
  );
}

function AddQuestion({ category, label, onAdd }: { category: QuestionCategory; label: string; onAdd: KitEditor["actions"]["addQuestion"] }) {
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [outline, setOutline] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onAdd({ category, prompt, answer_outline: outline });
      setPrompt("");
      setOutline("");
      setOpen(false);
    } catch (failure) {
      setError(failure instanceof ApiError ? failure : new ApiError(0, "UNKNOWN", "Could not add the question."));
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <Button size="sm" variant="ghost" className="mt-2" onClick={() => setOpen(true)}>
        + Add a {label.toLowerCase()} question
      </Button>
    );
  }
  return (
    <Card className="mt-2 p-4">
      <form onSubmit={submit} className="space-y-3">
        {error && Object.keys(error.fields).length === 0 && <Alert tone="error">{error.message}</Alert>}
        <Field id={`new-${category}-prompt`} label="Your question" error={error?.fields.prompt}>
          {(props) => <Input {...props} autoFocus required maxLength={2000} value={prompt} onChange={(e) => setPrompt(e.target.value)} />}
        </Field>
        <Field id={`new-${category}-outline`} label="Answer outline (optional)" error={error?.fields.answer_outline}>
          {(props) => <Textarea {...props} rows={3} maxLength={6000} value={outline} onChange={(e) => setOutline(e.target.value)} />}
        </Field>
        <div className="flex gap-2">
          <Button type="submit" variant="primary" size="sm" busy={busy} disabled={prompt.trim().length === 0}>
            Add question
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
        </div>
      </form>
    </Card>
  );
}
