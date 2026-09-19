import { ApiError } from "./api";
import { coalesceKey, mergeOps, type KitOp } from "./kit-ops";
import type { StoredKit } from "./types";

const TYPING_PAUSE_MS = 700;

export type SaveState = "saved" | "saving" | "unsaved" | "failed";

interface Pending {
  op: KitOp;
  /** Text edits wait for a pause in typing; everything else goes at once. */
  notBefore: number;
}

export interface SaveQueueHandlers {
  send(op: KitOp): Promise<StoredKit>;
  /** The server's authoritative kit after a change was applied. */
  onAnswer(kit: StoredKit): void;
  onState(state: SaveState, error: string | null): void;
  /** A change the server refused for good (the item is gone, or the change no longer makes sense). */
  onRejected(message: string): void;
}

/**
 * Sends a user's changes to the server one at a time, in the order they were made.
 *
 * - Edits to the same item merge while they wait, so a burst of typing becomes one request.
 * - A request that fails for a passing reason (network, server error) stays at the front of the
 *   queue; the user is told and can retry. Nothing is dropped silently.
 * - A request the server refuses outright is dropped, and the caller is told to reload the kit.
 *
 * Plain class, no React: the rules are easier to read and to test in isolation.
 */
export class SaveQueue {
  private pending: Pending[] = [];
  private sending = false;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly handlers: SaveQueueHandlers) {}

  /** True when nothing is waiting or in flight, i.e. the server's copy is as new as the user's. */
  get idle(): boolean {
    return this.pending.length === 0 && !this.sending;
  }

  enqueue(op: KitOp, options: { typing?: boolean } = {}): void {
    const notBefore = options.typing ? Date.now() + TYPING_PAUSE_MS : 0;
    const key = coalesceKey(op);
    // The entry at the front may already be on its way, so only entries behind it can be merged into.
    const from = this.sending ? 1 : 0;
    const index = key ? this.pending.findIndex((entry, position) => position >= from && coalesceKey(entry.op) === key) : -1;
    if (index >= 0) this.pending[index] = { op: mergeOps(this.pending[index]!.op, op), notBefore };
    else this.pending.push({ op, notBefore });
    this.handlers.onState("unsaved", null);
    void this.pump();
  }

  retry(): void {
    this.handlers.onState("unsaved", null);
    void this.pump();
  }

  /** Everything still waiting, handed over and forgotten. For sending on the way out of the page. */
  drain(): KitOp[] {
    if (this.timer) clearTimeout(this.timer);
    const ops = this.pending.slice(this.sending ? 1 : 0).map((entry) => entry.op);
    this.pending = [];
    return ops;
  }

  private async pump(): Promise<void> {
    if (this.sending) return;
    const next = this.pending[0];
    if (!next) return this.handlers.onState("saved", null);

    const wait = next.notBefore - Date.now();
    if (wait > 0) {
      if (this.timer) clearTimeout(this.timer);
      this.timer = setTimeout(() => void this.pump(), wait);
      return;
    }

    this.sending = true;
    this.handlers.onState("saving", null);
    try {
      const answer = await this.handlers.send(next.op);
      this.pending.shift();
      this.sending = false;
      this.handlers.onAnswer(answer);
    } catch (failure) {
      this.sending = false;
      const error = failure instanceof ApiError ? failure : new ApiError(0, "UNKNOWN", "Could not save.");
      if (error.status === 404 || error.status === 400) {
        this.pending.shift();
        this.handlers.onRejected(error.message);
      } else {
        return this.handlers.onState("failed", error.message);
      }
    }
    void this.pump();
  }
}
