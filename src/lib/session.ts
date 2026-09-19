"use client";

import useSWR from "swr";
import { api, fetcher, type ApiError } from "./api";
import type { User } from "./types";

/** The signed-in user. A 401 here is handled by `api`, which sends the user to sign in. */
export function useSession() {
  const { data, error, isLoading, mutate } = useSWR<{ user: User }, ApiError>("/auth/me", fetcher, { shouldRetryOnError: false, revalidateOnFocus: false });
  return { user: data?.user, error, isLoading, refresh: mutate };
}

export async function signOut(): Promise<void> {
  await api("/auth/logout", { method: "POST" }).catch(() => undefined);
  // A full page load on purpose: it drops every piece of client state that belonged to the old session.
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.assign("/login");
}
