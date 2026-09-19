"use client";

import clsx from "clsx";
import { useCallback, useEffect, useState } from "react";
import useSWR from "swr";
import { api, ApiError, fetcher } from "@/lib/api";
import type { Flashcard, Kit, PracticeOverview } from "@/lib/types";
import { Alert, Button, Card, EmptyState, Skeleton } from "../ui/primitives";

const CONFIDENCE: Array<{ value: 1 | 2 | 3 | 4; label: string; hint: string; classes: string }> = [
  { value: 1, label: "No idea", hint: "Back to the start", classes: "border-red-200 text-red-800 hover:bg-red-50" },
  { value: 2, label: "Shaky", hint: "Show it again soon", classes: "border-amber-200 text-amber-800 hover:bg-amber-50" },
  { value: 3, label: "Mostly", hint: "Moving up", classes: "border-sky-200 text-sky-800 hover:bg-sky-50" },
  { value: 4, label: "Confident", hint: "Moving up fast", classes: "border-emerald-200 text-emerald-800 hover:bg-emerald-50" },
];

/**
 * One card at a time: read the front, reveal the answer, say how confident you felt. The order of
 * the next session comes from the server (unseen first, then the lowest box, then least recent).
 * Everything works from the keyboard: Space or Enter reveals, 1 to 4 rates.
 */
export function PracticeTab({ kitId, kit }: { kitId: string; kit: Kit }) {
  const key = `/kits/${kitId}/practice`;
  const { data, error, isLoading, mutate } = useSWR<PracticeOverview, ApiError>(key, fetcher, { revalidateOnFocus: false });
  const [session, setSession] = useState<string[] | null>(null);
  const [position, setPosition] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rateError, setRateError] = useState<string | null>(null);

  const cards = new Map(kit.flashcards.map((card) => [card.id, card]));
  const current: Flashcard | undefined = session ? cards.get(session[position] ?? "") : undefined;
  const finished = session !== null && position >= session.length;

  const rate = useCallback(
    async (confidence: 1 | 2 | 3 | 4) => {
      if (!current || saving) return;
      setSaving(true);
      setRateError(null);
      try {
        const next = await api<PracticeOverview>(`${key}/ratings`, { method: "POST", body: { flashcard_id: current.id, confidence } });
        await mutate(next, { revalidate: false });
        setRevealed(false);
        setPosition((value) => value + 1);
      } catch (failure) {
        setRateError(failure instanceof ApiError ? failure.message : "Could not record that. Try again.");
      } finally {
        setSaving(false);
      }
    },
    [current, saving, key, mutate],
  );

  useEffect(() => {
    if (!current) return;
    function onKey(event: KeyboardEvent) {
      if (event.target instanceof HTMLElement && ["INPUT", "TEXTAREA", "SELECT"].includes(event.target.tagName)) return;
      if (!revealed && (event.key === " " || event.key === "Enter")) {
        event.preventDefault();
        setRevealed(true);
      } else if (revealed && ["1", "2", "3", "4"].includes(event.key)) {
        void rate(Number(event.key) as 1 | 2 | 3 | 4);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [current, revealed, rate]);

  if (kit.flashcards.length === 0) return <EmptyState title="Nothing to practise yet">Add flashcards in the Flashcards tab, then come back.</EmptyState>;
  if (isLoading) return <Skeleton className="h-64 w-full" />;
  if (error || !data) {
    return (
      <Alert tone="error" title="Could not load your practice progress" action={<Button size="sm" onClick={() => void mutate()}>Try again</Button>}>
        {error?.message}
      </Alert>
    );
  }

  const { coverage } = data;
  const start = () => {
    setSession(data.session.filter((id) => cards.has(id)));
    setPosition(0);
    setRevealed(false);
  };

  return (
    <div className="space-y-6">
      <Card className="p-5" aria-labelledby="progress-heading">
        <h2 id="progress-heading" className="text-lg font-semibold">
          Your progress
        </h2>
        <dl className="mt-3 grid grid-cols-3 gap-3 text-center">
          <Stat label="Covered" value={`${coverage.covered} / ${coverage.total}`} />
          <Stat label="Not covered yet" value={coverage.notCovered} />
          <Stat label="Mastered" value={coverage.mastered} />
        </dl>
        <div className="mt-4" role="img" aria-label={`Cards per box, from box 1 to 5: ${coverage.boxes.join(", ")}. Not seen yet: ${coverage.notCovered}.`}>
          <div className="flex h-3 overflow-hidden rounded-full bg-slate-200">
            {coverage.boxes.map((count, index) => (
              <span key={index} style={{ width: `${(count / Math.max(coverage.total, 1)) * 100}%` }} className={["bg-red-400", "bg-amber-400", "bg-sky-400", "bg-emerald-400", "bg-emerald-600"][index]} />
            ))}
          </div>
          <p className="mt-1.5 text-xs text-slate-600">Red: just started. Green: you know it. Grey: not seen yet.</p>
        </div>
      </Card>

      {!session && (
        <Card className="p-5 text-center">
          <p className="font-medium text-slate-900">Next session: {Math.min(data.session.length, kit.flashcards.length)} cards</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-slate-600">Cards you have not seen come first, then the ones you were least confident about, then the ones you have not seen for longest.</p>
          <Button variant="primary" className="mt-4" onClick={start}>
            {coverage.covered === 0 ? "Start practising" : "Start next session"}
          </Button>
        </Card>
      )}

      {current && session && (
        <Card className="p-5" aria-live="polite">
          <p className="text-sm text-slate-600">
            Card {position + 1} of {session.length}
          </p>
          <p className="mt-3 text-xl font-medium leading-snug text-slate-900">{current.front}</p>

          {!revealed ? (
            <Button variant="primary" className="mt-6" onClick={() => setRevealed(true)}>
              Reveal answer <kbd className="rounded bg-indigo-500 px-1.5 text-xs">Space</kbd>
            </Button>
          ) : (
            <>
              <p className="mt-4 whitespace-pre-wrap rounded-md bg-slate-50 p-4 leading-relaxed text-slate-800">{current.back || "This card has no answer yet. Add one in the Flashcards tab."}</p>
              <fieldset className="mt-5" disabled={saving}>
                <legend className="text-sm font-medium text-slate-800">How confident did you feel?</legend>
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {CONFIDENCE.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => void rate(option.value)}
                      className={clsx("rounded-md border bg-white px-3 py-2 text-left text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50", option.classes)}
                    >
                      <kbd className="mr-1.5 rounded bg-slate-100 px-1.5 text-xs text-slate-700">{option.value}</kbd>
                      {option.label}
                      <span className="block text-xs font-normal opacity-80">{option.hint}</span>
                    </button>
                  ))}
                </div>
              </fieldset>
            </>
          )}
          {rateError && (
            <div className="mt-4">
              <Alert tone="error">{rateError}</Alert>
            </div>
          )}
        </Card>
      )}

      {finished && (
        <Card className="p-5 text-center">
          <p className="text-lg font-semibold text-slate-900">Session done</p>
          <p className="mt-1 text-sm text-slate-600">
            {data.weak_spots.length > 0
              ? `You were unsure about ${data.weak_spots.length} requirement${data.weak_spots.length === 1 ? "" : "s"}. The Schedule tab can re-plan your remaining days around them.`
              : "No weak spots in this session."}
          </p>
          <Button variant="primary" className="mt-4" onClick={start}>
            Start next session
          </Button>
        </Card>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md bg-slate-50 px-2 py-3">
      <dd className="text-xl font-semibold text-slate-900">{value}</dd>
      <dt className="text-xs text-slate-600">{label}</dt>
    </div>
  );
}
