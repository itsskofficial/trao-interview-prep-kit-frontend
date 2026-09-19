import type { Flashcard, Kit, Question, QuestionCategory } from "./types";

/**
 * A change to a kit, described as data. Each one knows how to apply itself to
 * the local copy straight away (so the screen never waits for the network) and
 * which small request tells the server the same thing. The server applies the
 * same rules and answers with the authoritative kit.
 */
export type KitOp =
  | { type: "patchQuestion"; id: string; patch: Partial<Pick<Question, "prompt" | "answer_outline" | "difficulty" | "requirement_ids">> }
  | { type: "deleteQuestion"; id: string }
  | { type: "reorderQuestions"; category: QuestionCategory; ids: string[] }
  | { type: "moveQuestion"; id: string; category: QuestionCategory; index: number }
  | { type: "patchFlashcard"; id: string; patch: Partial<Pick<Flashcard, "front" | "back">> }
  | { type: "deleteFlashcard"; id: string }
  | { type: "reorderFlashcards"; ids: string[] }
  | { type: "patchBrief"; patch: Partial<Pick<Kit["company_brief"], "summary" | "what_they_do">> }
  | { type: "pin"; target: { kind: "question" | "flashcard"; id: string } | { kind: "brief" }; pinned: boolean };

export interface OpRequest {
  method: "PATCH" | "PUT" | "POST" | "DELETE";
  path: string;
  body?: unknown;
}

/** Edits to the same thing replace each other while they wait, so ten keystrokes become one request. */
export function coalesceKey(op: KitOp): string | undefined {
  switch (op.type) {
    case "patchQuestion": return `question:${op.id}`;
    case "patchFlashcard": return `flashcard:${op.id}`;
    case "patchBrief": return "brief";
    case "reorderQuestions": return `order:${op.category}`;
    case "reorderFlashcards": return "order:flashcards";
    default: return undefined;
  }
}

export function mergeOps(earlier: KitOp, later: KitOp): KitOp {
  if (earlier.type === "patchQuestion" && later.type === "patchQuestion") return { ...later, patch: { ...earlier.patch, ...later.patch } };
  if (earlier.type === "patchFlashcard" && later.type === "patchFlashcard") return { ...later, patch: { ...earlier.patch, ...later.patch } };
  if (earlier.type === "patchBrief" && later.type === "patchBrief") return { ...later, patch: { ...earlier.patch, ...later.patch } };
  return later;
}

export function toRequest(op: KitOp): OpRequest {
  switch (op.type) {
    case "patchQuestion": return { method: "PATCH", path: `/questions/${op.id}`, body: op.patch };
    case "deleteQuestion": return { method: "DELETE", path: `/questions/${op.id}` };
    case "reorderQuestions": return { method: "PUT", path: "/questions/order", body: { category: op.category, ids: op.ids } };
    case "moveQuestion": return { method: "POST", path: `/questions/${op.id}/move`, body: { category: op.category, index: op.index } };
    case "patchFlashcard": return { method: "PATCH", path: `/flashcards/${op.id}`, body: op.patch };
    case "deleteFlashcard": return { method: "DELETE", path: `/flashcards/${op.id}` };
    case "reorderFlashcards": return { method: "PUT", path: "/flashcards/order", body: { ids: op.ids } };
    case "patchBrief": return { method: "PATCH", path: "/brief", body: op.patch };
    case "pin": return { method: "PUT", path: "/pins", body: { ...op.target, pinned: op.pinned } };
  }
}

/** The local half. Coverage and schedule are left to the server, which recomputes them and sends them back. */
export function applyLocally(kit: Kit, op: KitOp): Kit {
  switch (op.type) {
    case "patchQuestion":
      return { ...kit, questions: kit.questions.map((q) => (q.id === op.id ? { ...q, ...op.patch, edited: true } : q)) };
    case "deleteQuestion":
      return { ...kit, questions: kit.questions.filter((q) => q.id !== op.id) };
    case "reorderQuestions": {
      const byId = new Map(kit.questions.map((q) => [q.id, q]));
      const ordered = op.ids.flatMap((id) => (byId.get(id) ? [byId.get(id)!] : []));
      let cursor = 0;
      return { ...kit, questions: kit.questions.map((q) => (q.category === op.category ? (ordered[cursor++] ?? q) : q)) };
    }
    case "moveQuestion": {
      const moving = kit.questions.find((q) => q.id === op.id);
      if (!moving) return kit;
      const moved: Question = moving.category === op.category ? moving : { ...moving, category: op.category, pinned: true };
      const others = kit.questions.filter((q) => q.id !== op.id);
      const slots = others.flatMap((q, position) => (q.category === op.category ? [position] : []));
      const at = op.index < slots.length ? slots[op.index]! : slots.length > 0 ? slots.at(-1)! + 1 : others.length;
      return { ...kit, questions: [...others.slice(0, at), moved, ...others.slice(at)] };
    }
    case "patchFlashcard":
      return { ...kit, flashcards: kit.flashcards.map((f) => (f.id === op.id ? { ...f, ...op.patch, edited: true } : f)) };
    case "deleteFlashcard":
      return { ...kit, flashcards: kit.flashcards.filter((f) => f.id !== op.id) };
    case "reorderFlashcards": {
      const byId = new Map(kit.flashcards.map((f) => [f.id, f]));
      return { ...kit, flashcards: op.ids.flatMap((id) => (byId.get(id) ? [byId.get(id)!] : [])) };
    }
    case "patchBrief":
      return { ...kit, company_brief: { ...kit.company_brief, ...op.patch, edited: true } };
    case "pin":
      if (op.target.kind === "brief") return { ...kit, company_brief: { ...kit.company_brief, pinned: op.pinned } };
      if (op.target.kind === "question") {
        const { id } = op.target;
        return { ...kit, questions: kit.questions.map((q) => (q.id === id ? { ...q, pinned: op.pinned } : q)) };
      }
      {
        const { id } = op.target;
        return { ...kit, flashcards: kit.flashcards.map((f) => (f.id === id ? { ...f, pinned: op.pinned } : f)) };
      }
  }
}
