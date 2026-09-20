import type { KitOp } from "./kit-ops";

/**
 * Changes the server has not confirmed yet, kept in the browser so that closing the tab while offline
 * does not lose them. A change is plain data (see kit-ops), so it can be written down and sent later.
 *
 * Sending a change twice is harmless, which is what makes this safe: an edit sets text to a value, a
 * reorder sets an order, a pin sets a flag. Only a delete can be refused the second time, because the
 * item is already gone, and that refusal is exactly what was wanted.
 */
const PREFIX = "prep-kit:unsaved:";
const VERSION = 1;
/** Changes older than this are dropped: by then the kit has moved on and replaying them would surprise more than help. */
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_OPS = 200;

interface Saved {
  version: number;
  savedAt: number;
  ops: KitOp[];
}

const OP_TYPES = new Set<KitOp["type"]>(["patchQuestion", "deleteQuestion", "reorderQuestions", "moveQuestion", "patchFlashcard", "deleteFlashcard", "reorderFlashcards", "patchBrief", "pin"]);

/** Storage can be unavailable (private mode, quota, a disabled setting). Nothing here may ever throw at the editor. */
function storage(): Storage | undefined {
  try {
    return typeof window === "undefined" ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
}

export function saveUnsaved(kitId: string, ops: KitOp[]): void {
  const store = storage();
  if (!store) return;
  try {
    if (ops.length === 0) store.removeItem(PREFIX + kitId);
    else store.setItem(PREFIX + kitId, JSON.stringify({ version: VERSION, savedAt: Date.now(), ops: ops.slice(-MAX_OPS) } satisfies Saved));
  } catch {
    // Full or forbidden: the changes are still in memory and still being sent.
  }
}

export function loadUnsaved(kitId: string, now = Date.now()): KitOp[] {
  const store = storage();
  if (!store) return [];
  try {
    const raw = store.getItem(PREFIX + kitId);
    if (!raw) return [];
    const saved = JSON.parse(raw) as Partial<Saved>;
    // Written by this application, but read back from a place anything on the page can write to.
    if (saved.version !== VERSION || typeof saved.savedAt !== "number" || now - saved.savedAt > MAX_AGE_MS || !Array.isArray(saved.ops)) {
      store.removeItem(PREFIX + kitId);
      return [];
    }
    return saved.ops.filter((op): op is KitOp => typeof op === "object" && op !== null && OP_TYPES.has((op as KitOp).type));
  } catch {
    return [];
  }
}

export function clearUnsaved(kitId: string): void {
  saveUnsaved(kitId, []);
}
