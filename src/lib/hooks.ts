"use client";

import useSWR from "swr";
import { fetcher, type ApiError } from "./api";
import type { Job, KitSummary } from "./types";

const POLL_MS = 2_000;
export const isActive = (job: Pick<Job, "status">) => job.status === "queued" || job.status === "running";

export function useKits() {
  return useSWR<{ kits: KitSummary[] }, ApiError>("/kits", fetcher);
}

/** Polls only while something is actually running. */
export function useJobs() {
  return useSWR<{ jobs: Job[] }, ApiError>("/jobs", fetcher, {
    refreshInterval: (data) => (data?.jobs.some(isActive) ? POLL_MS : 0),
  });
}

/** One job, polled until it finishes. Survives leaving the page: the job lives on the server, not in this tab. */
export function useJob(id: string) {
  return useSWR<{ job: Job }, ApiError>(`/jobs/${id}`, fetcher, {
    refreshInterval: (data) => (!data || isActive(data.job) ? POLL_MS : 0),
  });
}
