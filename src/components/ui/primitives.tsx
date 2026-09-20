import clsx from "clsx";
import type { ButtonHTMLAttributes, ComponentProps, InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";

/** Small, unstyled-by-default building blocks. Every interactive one has a visible focus ring. */

const focusRing = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600";

const BUTTON_VARIANTS = {
  primary: "bg-gradient-to-b from-indigo-500 to-indigo-600 text-white shadow-sm shadow-indigo-600/30 hover:from-indigo-500 hover:to-indigo-700 active:translate-y-px disabled:from-indigo-300 disabled:to-indigo-300 disabled:shadow-none",
  secondary: "border border-slate-200 bg-surface text-slate-800 shadow-sm hover:border-slate-300 hover:bg-slate-50 active:translate-y-px disabled:text-slate-400 disabled:shadow-none",
  ghost: "text-slate-700 hover:bg-slate-100 disabled:text-slate-400",
  danger: "border border-red-200 bg-surface text-red-700 hover:bg-red-50 disabled:text-red-300",
} as const;

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof BUTTON_VARIANTS;
  size?: "sm" | "md";
  busy?: boolean;
}

export function Button({ variant = "secondary", size = "md", busy = false, className, children, disabled, type = "button", ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      className={clsx(
        "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition disabled:cursor-not-allowed",
        size === "sm" ? "min-h-8 px-2.5 text-sm" : "min-h-10 px-4 text-sm",
        BUTTON_VARIANTS[variant],
        focusRing,
        className,
      )}
      {...rest}
    >
      {busy && <Spinner className="h-4 w-4" />}
      {children}
    </button>
  );
}

const fieldBox =
  "block w-full rounded-lg border border-slate-200 bg-surface px-3 py-2 text-slate-900 shadow-sm transition placeholder:text-slate-400 hover:border-slate-300 aria-[invalid=true]:border-red-500 " + focusRing;

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={clsx(fieldBox, className)} {...rest} />;
}

export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={clsx(fieldBox, "leading-relaxed", className)} {...rest} />;
}

/** A labelled field whose error is announced and tied to the control by id. */
export function Field({ id, label, hint, error, children }: { id: string; label: string; hint?: string; error?: string; children: (props: { id: string; "aria-invalid": boolean; "aria-describedby"?: string }) => ReactNode }) {
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ") || undefined;
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-slate-800">
        {label}
      </label>
      {children({ id, "aria-invalid": Boolean(error), "aria-describedby": describedBy })}
      {hint && !error && (
        <p id={`${id}-hint`} className="text-sm text-slate-500">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}

const ALERT_TONES = {
  error: "border-red-200 bg-red-50 text-red-900",
  warning: "border-amber-200 bg-amber-50 text-amber-900",
  info: "border-sky-200 bg-sky-50 text-sky-900",
  success: "border-emerald-200 bg-emerald-50 text-emerald-900",
} as const;

export function Alert({ tone = "info", title, children, action }: { tone?: keyof typeof ALERT_TONES; title?: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div role={tone === "error" ? "alert" : "status"} className={clsx("flex animate-rise flex-wrap items-start justify-between gap-3 rounded-xl border px-4 py-3 text-sm", ALERT_TONES[tone])}>
      <div className="min-w-0 space-y-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className="leading-relaxed">{children}</div>}
      </div>
      {action}
    </div>
  );
}

export function Spinner({ className, label }: { className?: string; label?: string }) {
  return (
    <span role={label ? "status" : undefined} className="inline-flex items-center gap-2">
      <svg className={clsx("animate-spin", className ?? "h-5 w-5")} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.25" />
        <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      </svg>
      {label && <span className="text-sm text-slate-600">{label}</span>}
    </span>
  );
}

export function Card({ className, ...rest }: ComponentProps<"section">) {
  return <section className={clsx("rounded-2xl border border-slate-200/80 bg-surface shadow-card", className)} {...rest} />;
}

const BADGE_TONES = {
  neutral: "bg-slate-100 text-slate-700",
  indigo: "bg-indigo-50 text-indigo-700",
  amber: "bg-amber-50 text-amber-800",
  emerald: "bg-emerald-50 text-emerald-800",
  red: "bg-red-50 text-red-800",
  violet: "bg-violet-50 text-violet-800",
} as const;

export function Badge({ tone = "neutral", children, title }: { tone?: keyof typeof BADGE_TONES; children: ReactNode; title?: string }) {
  return (
    <span title={title} className={clsx("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ring-black/5", BADGE_TONES[tone])}>
      {children}
    </span>
  );
}

/** What a list shows when there is nothing in it yet. */
export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-surface/60 px-6 py-12 text-center">
      <p className="font-medium text-slate-900">{title}</p>
      {children && <p className="mx-auto mt-1 max-w-md text-sm text-slate-600">{children}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/** A grey block standing in for content that is still loading. */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={clsx("animate-shimmer rounded-xl bg-[linear-gradient(90deg,#e2e8f0_25%,#f1f5f9_50%,#e2e8f0_75%)] bg-[length:200%_100%]", className)} />;
}
