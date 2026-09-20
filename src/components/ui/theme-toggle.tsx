"use client";

import { useSyncExternalStore } from "react";
import { THEME_STORAGE_KEY as KEY } from "@/lib/theme-script";

export type ThemeChoice = "system" | "light" | "dark";
const ORDER: ThemeChoice[] = ["system", "light", "dark"];
const LABEL: Record<ThemeChoice, string> = { system: "Match my device", light: "Light", dark: "Dark" };

const listeners = new Set<() => void>();

function read(): ThemeChoice {
  const choice = document.documentElement.dataset.themeChoice;
  return choice === "light" || choice === "dark" ? choice : "system";
}

function apply(choice: ThemeChoice): void {
  const dark = choice === "dark" || (choice === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  document.documentElement.dataset.themeChoice = choice;
  try {
    window.localStorage.setItem(KEY, choice);
  } catch {
    // Storage unavailable: the choice lasts for this page, which is still better than ignoring it.
  }
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  // Someone on "match my device" whose device changes its mind at sunset.
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const follow = () => {
    if (read() === "system") apply("system");
  };
  media.addEventListener("change", follow);
  return () => {
    listeners.delete(listener);
    media.removeEventListener("change", follow);
  };
}

/** One button that steps through the three choices. It says what is chosen now, not what pressing it will do. */
export function ThemeToggle() {
  const choice = useSyncExternalStore<ThemeChoice>(subscribe, read, () => "system");
  const next = ORDER[(ORDER.indexOf(choice) + 1) % ORDER.length]!;

  return (
    <button
      type="button"
      onClick={() => apply(next)}
      aria-label={`Colour theme: ${LABEL[choice]}. Switch to ${LABEL[next].toLowerCase()}.`}
      title={`Theme: ${LABEL[choice]}`}
      className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
    >
      <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {choice === "dark" ? (
          <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" />
        ) : choice === "light" ? (
          <>
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
          </>
        ) : (
          <>
            <rect x="3" y="4" width="18" height="12" rx="2" />
            <path d="M8 20h8m-4-4v4" />
          </>
        )}
      </svg>
    </button>
  );
}
