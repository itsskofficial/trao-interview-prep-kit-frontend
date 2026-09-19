"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import useSWR, { mutate as writeCache } from "swr";
import { api, fetcher, type ApiError } from "./api";
import { applyLocally, toRequest, type KitOp } from "./kit-ops";
import { SaveQueue, type SaveState } from "./save-queue";
import type { Flashcard, Kit, Question, QuestionCategory, StoredKit } from "./types";

const POLL_WHILE_REGENERATING_MS = 2_000;

/** A change that would leave a required field blank stays on screen but is not sent: the server would refuse it and the old text would come back under the cursor. */
const leavesRequiredFieldBlank = (op: KitOp): boolean =>
  (op.type === "patchQuestion" && op.patch.prompt !== undefined && op.patch.prompt.trim() === "") ||
  (op.type === "patchFlashcard" && op.patch.front !== undefined && op.patch.front.trim() === "");

/**
 * The kit as the user sees it, which is always a step ahead of the server.
 *
 * What is shown is derived, never copied: the server's kit from the shared cache, unless the user has
 * changes the server has not confirmed yet, in which case their local version (`ahead`). A change is
 * applied to the local version at once and handed to the save queue. When the queue runs dry, the
 * server's answer goes into the cache and the local version is dropped, so the two can never drift,
 * and an answer that arrives while more changes are waiting cannot overwrite them.
 */
export function useKitEditor(id: string) {
  const key = `/kits/${id}`;
  const [ahead, setAhead] = useState<Kit | null>(null);
  const [save, setSave] = useState<{ state: SaveState; error: string | null }>({ state: "saved", error: null });
  const [rejected, setRejected] = useState<string | null>(null);

  const { data: stored, error: loadError } = useSWR<StoredKit, ApiError>(key, fetcher, {
    revalidateOnFocus: false,
    refreshInterval: (latest) => (latest?.regeneration?.status === "running" ? POLL_WHILE_REGENERATING_MS : 0),
  });
  const kit = ahead ?? stored?.kit ?? null;

  // Created once. Its handlers need to ask the queue whether it is idle, hence the holder.
  const [{ queue }] = useState(() => {
    const holder = { queue: undefined as unknown as SaveQueue };
    const settle = () => {
      if (holder.queue.idle) setAhead(null);
    };
    holder.queue = new SaveQueue({
      send: (op) => {
        const request = toRequest(op);
        return api<StoredKit>(`${key}${request.path}`, { method: request.method, body: request.body });
      },
      onAnswer: (answer) => void writeCache(key, answer, { revalidate: false }).then(settle),
      onState: (state, error) => setSave({ state, error }),
      onRejected: (message) => {
        setRejected(message);
        void writeCache(key).then(settle);
      },
    });
    return holder;
  });

  // Leaving, by navigating or by closing the tab: send whatever was still waiting for a pause in typing,
  // in order, then refresh the cache so the next screen does not show the kit from before those changes.
  useEffect(() => {
    const sendWaiting = () => {
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
        await writeCache(key);
      })();
    };
    window.addEventListener("pagehide", sendWaiting);
    return () => {
      window.removeEventListener("pagehide", sendWaiting);
      sendWaiting();
    };
  }, [key, queue]);

  // Warn before closing the tab with unsaved work.
  useEffect(() => {
    if (save.state === "saved") return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [save.state]);

  const base = stored?.kit;
  const dispatch = useCallback(
    (op: KitOp, options: { typing?: boolean } = {}) => {
      if (!base) return;
      setAhead((current) => applyLocally(current ?? base, op));
      if (!leavesRequiredFieldBlank(op)) queue.enqueue(op, options);
    },
    [queue, base],
  );

  /** Requests that need the server's answer before anything can be shown (a new id, a started regeneration). */
  const request = useCallback(
    async (path: string, body?: unknown): Promise<StoredKit> => {
      const answer = await api<StoredKit>(`${key}${path}`, { method: "POST", body });
      await writeCache(key, answer, { revalidate: false });
      if (queue.idle) setAhead(null);
      return answer;
    },
    [key, queue],
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
      reload: () => void writeCache(key),
    }),
    [dispatch, request, queue, key],
  );

  return {
    kit,
    stored: stored ?? null,
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
