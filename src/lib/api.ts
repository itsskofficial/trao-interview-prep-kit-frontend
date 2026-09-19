/**
 * One place that talks to the backend. Every failure becomes an `ApiError` carrying the backend's
 * code, message and per-field details, so screens can show something specific.
 */

export interface FieldIssue {
  field: string;
  message: string;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }

  /** Per-field messages from a validation failure, keyed by field name. */
  get fields(): Record<string, string> {
    if (!Array.isArray(this.details)) return {};
    return Object.fromEntries((this.details as FieldIssue[]).filter((issue) => issue?.field).map((issue) => [issue.field, issue.message]));
  }

  get isAuth(): boolean {
    return this.status === 401;
  }
}

// ---- "waking the server": free hosting sleeps when idle, so the first request can take most of a minute ----

const SLOW_AFTER_MS = 4_000;
let slowRequests = 0;
const slowListeners = new Set<(slow: boolean) => void>();

export function onServerSlow(listener: (slow: boolean) => void): () => void {
  slowListeners.add(listener);
  return () => void slowListeners.delete(listener);
}

function trackSlowness(): () => void {
  let counted = false;
  const timer = setTimeout(() => {
    counted = true;
    if (++slowRequests === 1) slowListeners.forEach((listener) => listener(true));
  }, SLOW_AFTER_MS);
  return () => {
    clearTimeout(timer);
    if (counted && --slowRequests === 0) slowListeners.forEach((listener) => listener(false));
  };
}

// ---- expired sessions: any 401 outside the auth screens sends the user to sign in, and back again afterwards ----

let leaving = false;

function redirectToLogin(code: string): void {
  if (typeof window === "undefined" || leaving) return;
  const { pathname, search } = window.location;
  if (pathname === "/login" || pathname === "/register") return;
  const params = new URLSearchParams({ next: pathname + search });
  if (code === "SESSION_EXPIRED") params.set("reason", "expired");
  leaving = true; // several requests can fail at once; one trip to sign in is enough
  // The route guard only sees that a session cookie exists, so a cookie the server has stopped accepting
  // must be cleared first or the guard would send the visitor straight back here, forever.
  void fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" })
    .catch(() => undefined)
    .finally(() => {
      // A full page load on purpose: it drops every piece of client state that belonged to the old session.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign(`/login?${params}`);
    });
}

export interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  signal?: AbortSignal;
  /** Auth screens handle their own 401s. */
  redirectOn401?: boolean;
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, signal, redirectOn401 = true } = options;
  const done = trackSlowness();

  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      method,
      signal,
      credentials: "same-origin",
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (error) {
    if ((error as Error).name === "AbortError") throw error;
    throw new ApiError(0, "NETWORK", "Could not reach the server. Check your connection and try again.");
  } finally {
    done();
  }

  if (response.status === 204) return undefined as T;
  const payload: unknown = await response.json().catch(() => undefined);

  if (!response.ok) {
    const error = (payload as { error?: { code?: string; message?: string; details?: unknown } } | undefined)?.error;
    const failure = new ApiError(
      response.status,
      error?.code ?? "UNKNOWN",
      error?.message ?? (response.status >= 500 ? "The server is not responding properly. Try again in a moment." : "The request failed."),
      error?.details,
    );
    if (failure.isAuth && redirectOn401) redirectToLogin(failure.code);
    throw failure;
  }
  return payload as T;
}

/** For SWR. */
export const fetcher = <T>(path: string): Promise<T> => api<T>(path);
