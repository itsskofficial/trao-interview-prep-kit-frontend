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
/** A record dated in the future would never age out. A minute allows for a clock being corrected between visits. */
const CLOCK_SLACK_MS = 60_000;

interface Saved {
  version: number;
  savedAt: number;
  ops: KitOp[];
}

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
    // All of them: dropping the oldest to save space would be dropping exactly the edits that have waited longest.
    else store.setItem(PREFIX + kitId, JSON.stringify({ version: VERSION, savedAt: Date.now(), ops } satisfies Saved));
  } catch {
    // Full or forbidden: the changes are still in memory and still being sent.
  }
}

const CATEGORIES = new Set(["technical", "behavioural", "system-design", "company-fit"]);
const isText = (value: unknown): value is string => typeof value === "string" && value.length <= 20_000;
const isId = (value: unknown): value is string => typeof value === "string" && /^[a-z]\d{1,6}$/.test(value);
const isIds = (value: unknown): value is string[] => Array.isArray(value) && value.length <= 1_000 && value.every(isId);
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

/** A patch may set only these fields, each to a value of the right kind, and must set at least one. */
function isPatch(value: unknown, fields: Record<string, (field: unknown) => boolean>): boolean {
  if (!isRecord(value)) return false;
  const keys = Object.keys(value);
  return keys.length > 0 && keys.every((key) => key in fields && fields[key]!(value[key]));
}

/**
 * This was written by the application, but it is read back from a place anything running on the page can write to, and
 * what comes out is applied to the kit on screen and sent to the server. So every field of every kind of change is
 * checked, not just its name: `{ "type": "reorderQuestions" }` with no ids would otherwise crash the page that loads it.
 */
export function isKitOp(value: unknown): value is KitOp {
  if (!isRecord(value)) return false;
  switch (value.type) {
    case "patchQuestion":
      return isId(value.id) && isPatch(value.patch, { prompt: isText, answer_outline: isText, difficulty: (d) => d === 1 || d === 2 || d === 3, requirement_ids: isIds });
    case "patchFlashcard":
      return isId(value.id) && isPatch(value.patch, { front: isText, back: isText });
    case "patchBrief":
      return isPatch(value.patch, { summary: isText, what_they_do: isText });
    case "deleteQuestion":
    case "deleteFlashcard":
      return isId(value.id);
    case "reorderQuestions":
      return CATEGORIES.has(value.category as string) && isIds(value.ids);
    case "reorderFlashcards":
      return isIds(value.ids);
    case "moveQuestion":
      return isId(value.id) && CATEGORIES.has(value.category as string) && Number.isInteger(value.index) && (value.index as number) >= 0;
    case "pin": {
      const target = value.target;
      if (typeof value.pinned !== "boolean" || !isRecord(target)) return false;
      return target.kind === "brief" || ((target.kind === "question" || target.kind === "flashcard") && isId(target.id));
    }
    default:
      return false;
  }
}

export function loadUnsaved(kitId: string, now = Date.now()): KitOp[] {
  const store = storage();
  if (!store) return [];
  try {
    const raw = store.getItem(PREFIX + kitId);
    if (!raw) return [];
    const saved = JSON.parse(raw) as Partial<Saved>;
    const usable = saved.version === VERSION && typeof saved.savedAt === "number" && Number.isFinite(saved.savedAt) && saved.savedAt <= now + CLOCK_SLACK_MS && now - saved.savedAt <= MAX_AGE_MS && Array.isArray(saved.ops) && saved.ops.every(isKitOp);
    // All or nothing: changes depend on the ones before them, so a list with a hole in it is not the list that was made.
    if (!usable) {
      store.removeItem(PREFIX + kitId);
      return [];
    }
    return saved.ops!;
  } catch {
    try {
      store.removeItem(PREFIX + kitId);
    } catch {
      // nothing more to do
    }
    return [];
  }
}
