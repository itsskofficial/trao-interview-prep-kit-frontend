"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import useSWR, { mutate as revalidate } from "swr";
import { api, fetcher, type ApiError } from "./api";
import { applyLocally, toRequest, type KitOp } from "./kit-ops";
import { SaveQueue, type SaveState } from "./save-queue";
import type { Flashcard, Kit, Question, QuestionCategory, StoredKit } from "./types";

const POLL_WHILE_REGENERATING_MS = 2_000;

/**
 * The kit as the user sees it, which is always a step ahead of the server.
 *
 * - A change is applied to the local kit immediately and handed to the save queue.
 * - The server's copy replaces the local one only when the queue is idle, so an answer that
 *   arrives late can never overwrite what the user has typed since.
 * - While a section is regenerating, the kit is re-fetched every two seconds, under the same rule.
 */
export function useKitEditor(id: string) {
  const key = `/kits/${id}`;
  const [kit, setKit] = useState<Kit | null>(null);
  const [stored, setStored] = useState<StoredKit | null>(null);
  const [save, setSave] = useState<{ state: SaveState; error: string | null }>({ state: "saved", error: null });
  const [rejected, setRejected] = useState<string | null>(null);

  // Created once. The handlers need to ask the queue whether it is idle, hence the holder.
  const [{ queue }] = useState(() => {
    const holder = { queue: undefined as unknown as SaveQueue };
    const acceptAnswer = (latest: StoredKit) => {
      setStored(latest);
      if (holder.queue.idle) setKit(latest.kit);
      // Other screens read this kit from the shared cache (the one-page summary, for one), so keep it current.
      void revalidate(key, latest, { revalidate: false });
    };
    holder.queue = new SaveQueue({
      send: (op) => {
        const request = toRequest(op);
        return api<StoredKit>(`${key}${request.path}`, { method: request.method, body: request.body });
      },
      onAnswer: acceptAnswer,
      onState: (state, error) => setSave({ state, error }),
      onRejected: (message) => {
        setRejected(message);
        void revalidate(key);
      },
    });
    return holder;
  });

  const accept = useCallback(
    (latest: StoredKit) => {
      setStored(latest);
      if (queue.idle) setKit(latest.kit);
    },
    [queue],
  );

  const { error: loadError } = useSWR<StoredKit, ApiError>(key, fetcher, {
    revalidateOnFocus: false,
    refreshInterval: (latest) => (latest?.regeneration?.status === "running" ? POLL_WHILE_REGENERATING_MS : 0),
    onSuccess: accept,
  });

  // Leaving the page: send whatever was still waiting for a pause in typing, in order, and then
  // refresh the shared cache so the next screen does not show the kit from before those changes.
  useEffect(
    () => () => {
      const ops = queue.drain();
      if (ops.length === 0) return;
      void (async () => {
        for (const op of ops) {
          const request = toRequest(op);
          await fetch(`/api${key}${request.path}`, {
            method: request.method,
            keepalive: true,
            credentials: "same-origin",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(request.body ?? {}),
          }).catch(() => undefined);
        }
        await revalidate(key);
      })();
    },
    [key, queue],
  );

  // Warn before closing the tab with unsaved work.
  useEffect(() => {
    if (save.state === "saved") return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [save.state]);

  const dispatch = useCallback(
    (op: KitOp, options: { typing?: boolean } = {}) => {
      setKit((current) => (current ? applyLocally(current, op) : current));
      queue.enqueue(op, options);
    },
    [queue],
  );

  /** Requests that need the server's answer before anything can be shown (a new id, a started regeneration). */
  const request = useCallback(
    async (path: string, body?: unknown): Promise<StoredKit> => {
      const answer = await api<StoredKit>(`${key}${path}`, { method: "POST", body });
      accept(answer);
      // Tell the fetcher too, so it starts polling if a regeneration has just begun.
      void revalidate(key, answer, { revalidate: false });
      return answer;
    },
    [key, accept],
  );

  const actions = useMemo(
    () => ({
      editQuestion: (questionId: string, patch: Partial<Pick<Question, "prompt" | "answer_outline">>) => dispatch({ type: "patchQuestion", id: questionId, patch }, { typing: true }),
      setDifficulty: (questionId: string, difficulty: number) => dispatch({ type: "patchQuestion", id: questionId, patch: { difficulty } }),
      deleteQuestion: (questionId: string) => dispatch({ type: "deleteQuestion", id: questionId }),
      reorderQuestions: (category: QuestionCategory, ids: string[]) => dispatch({ type: "reorderQuestions", category, ids }),
      moveQuestion: (questionId: string, category: QuestionCategory, index: number) => dispatch({ type: "moveQuestion", id: questionId, category, index }),
      editFlashcard: (cardId: string, patch: Partial<Pick<Flashcard, "front" | "back">>) => dispatch({ type: "patchFlashcard", id: cardId, patch }, { typing: true }),
      deleteFlashcard: (cardId: string) => dispatch({ type: "deleteFlashcard", id: cardId }),
      reorderFlashcards: (ids: string[]) => dispatch({ type: "reorderFlashcards", ids }),
      editBrief: (patch: Partial<Pick<Kit["company_brief"], "summary" | "what_they_do">>) => dispatch({ type: "patchBrief", patch }, { typing: true }),
      pin: (target: Extract<KitOp, { type: "pin" }>["target"], pinned: boolean) => dispatch({ type: "pin", target, pinned }),
      addQuestion: (input: { category: QuestionCategory; prompt: string; answer_outline?: string; difficulty?: number; requirement_ids?: string[] }) => request("/questions", input),
      addFlashcard: (input: { front: string; back?: string }) => request("/flashcards", input),
      regenerate: (body: { section: "schedule" } | { section: "brief"; force?: boolean } | { section: "questions"; category: QuestionCategory }) => request("/regenerate", body),
      undoRegeneration: () => request("/regenerate/undo"),
      replan: (fromDay: number) => request("/practice/replan", { from_day: fromDay }),
      retrySave: () => queue.retry(),
      dismissRejected: () => setRejected(null),
      reload: () => void revalidate(key),
    }),
    [dispatch, request, queue, key],
  );

  return {
    kit,
    stored,
    loadError: loadError ?? null,
    saveState: save.state,
    saveError: save.error,
    rejected,
    regenerating: stored?.regeneration?.status === "running",
    actions,
  };
}

export type KitEditor = ReturnType<typeof useKitEditor>;
export type KitActions = KitEditor["actions"];
