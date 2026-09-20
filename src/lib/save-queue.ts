import { ApiError } from "./api";
import { coalesceKey, mergeOps, type KitOp } from "./kit-ops";
import type { StoredKit } from "./types";

const TYPING_PAUSE_MS = 700;

export type SaveState = "saved" | "saving" | "unsaved" | "failed";

interface Pending {
  op: KitOp;
  /** Text edits wait for a pause in typing; everything else goes at once. */
  notBefore: number;
  /** Brought back from a previous visit. If the server refuses it, that is not news: the kit has simply moved on. */
  restored?: boolean;
}

export interface SaveQueueHandlers {
  send(op: KitOp): Promise<StoredKit>;
  /** The server's authoritative kit after a change was applied. */
  onAnswer(kit: StoredKit): void;
  onState(state: SaveState, error: string | null): void;
  /** A change the server refused for good (the item is gone, or the change no longer makes sense). */
  onRejected(message: string): void;
  /** Everything not yet confirmed by the server, in order, whenever that changes. What a closed tab would otherwise lose. */
  onPending?(ops: KitOp[]): void;
  /** Everything owed has been confirmed by a route other than an answer to this queue (the page's exit delivery). */
  onSettled?(): void;
  /** A recovered change was refused and dropped without fuss. The kit on screen still shows it, so it needs refreshing. */
  onQuietDrop?(): void;
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
  private restoredOnce = false;
  /** Handed to the page's exit delivery, which sends them outside this queue. Unconfirmed until it says otherwise. */
  private leaving: KitOp[] = [];

  constructor(private readonly handlers: SaveQueueHandlers) {}

  /** True when nothing is waiting or in flight, i.e. the server's copy is as new as the user's. */
  get idle(): boolean {
    // What left through the page's exit is still owed until that delivery reports back.
    return this.pending.length === 0 && !this.sending && this.leaving.length === 0;
  }

  enqueue(op: KitOp, options: { typing?: boolean } = {}): void {
    const notBefore = options.typing ? Date.now() + TYPING_PAUSE_MS : 0;
    const key = coalesceKey(op);
    // Only the newest waiting entry can absorb a change, and not if it is already on its way. Merging into
    // an older entry would send this change ahead of whatever was done in between.
    const last = this.pending.length - 1;
    const inFlight = this.sending && last === 0;
    if (key && last >= 0 && !inFlight && coalesceKey(this.pending[last]!.op) === key) {
      this.pending[last] = { op: mergeOps(this.pending[last]!.op, op), notBefore };
    } else {
      this.pending.push({ op, notBefore });
    }
    this.changed();
    this.handlers.onState("unsaved", null);
    void this.pump();
  }

  /** Changes written down on an earlier visit and never confirmed. They go first, in the order they were made. */
  restore(ops: KitOp[]): void {
    // Once per queue: the development double-mount, or a caller asking twice, must not send them twice.
    if (this.restoredOnce || ops.length === 0) return;
    this.restoredOnce = true;
    this.pending.unshift(...ops.map((op) => ({ op, notBefore: 0, restored: true })));
    this.changed();
    this.handlers.onState("unsaved", null);
    void this.pump();
  }

  private changed(): void {
    // What is in flight here and what left through the exit are both unconfirmed, whichever answers first.
    this.handlers.onPending?.([...this.pending.map((entry) => entry.op), ...this.leaving]);
  }

  /** The exit delivery reports one of the changes it was handed as dealt with (saved, or refused for good). */
  delivered(op: KitOp): void {
    const index = this.leaving.indexOf(op);
    if (index === -1) return;
    this.leaving.splice(index, 1);
    this.changed();
    // The last thing owed: the server's copy is now as new as the user's, and whoever is showing a local version can drop it.
    if (this.idle) {
      this.handlers.onState("saved", null);
      this.handlers.onSettled?.();
    }
  }

  retry(): void {
    this.handlers.onState("unsaved", null);
    void this.pump();
  }

  /** Everything still waiting, handed over and forgotten. For sending on the way out of the page. */
  drain(): KitOp[] {
    if (this.timer) clearTimeout(this.timer);
    const ops = this.pending.slice(this.sending ? 1 : 0).map((entry) => entry.op);
    // The one in flight stays: its answer is still coming, and until it does it must stay written down.
    this.pending = this.sending ? this.pending.slice(0, 1) : [];
    this.leaving.push(...ops);
    this.changed();
    return ops;
  }

  private async pump(): Promise<void> {
    if (this.sending) return;
    const next = this.pending[0];
    if (!next) return this.handlers.onState(this.leaving.length > 0 ? "saving" : "saved", null);

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
      this.changed();
      this.handlers.onAnswer(answer);
    } catch (failure) {
      this.sending = false;
      const error = failure instanceof ApiError ? failure : new ApiError(0, "UNKNOWN", "Could not save.");
      if (error.status === 404 || error.status === 400) {
        this.pending.shift();
        this.changed();
        if (next.restored) this.handlers.onQuietDrop?.();
        else this.handlers.onRejected(error.message);
      } else {
        return this.handlers.onState("failed", error.message);
      }
    }
    void this.pump();
  }
}
