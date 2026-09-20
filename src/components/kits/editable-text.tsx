"use client";

import clsx from "clsx";
import { useLayoutEffect, useRef } from "react";

interface EditableTextProps {
  value: string;
  onChange(value: string): void;
  label: string;
  placeholder?: string;
  className?: string;
  maxLength?: number;
  disabled?: boolean;
  /** Blank is not allowed. A blank value is shown as invalid and is not saved until something is typed. */
  required?: boolean;
}

/**
 * Text that is always editable in place: no edit mode, no save button. It reads like text until it
 * is hovered or focused, grows with its content, and is reached with Tab like any other field.
 */
export function EditableText({ value, onChange, label, placeholder, className, maxLength, disabled, required }: EditableTextProps) {
  const blank = Boolean(required) && value.trim() === "";
  const ref = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    element.style.height = "auto";
    element.style.height = `${element.scrollHeight}px`;
  }, [value]);

  return (
    <textarea
      ref={ref}
      rows={1}
      value={value}
      disabled={disabled}
      maxLength={maxLength}
      aria-label={label}
      aria-required={required || undefined}
      aria-invalid={blank || undefined}
      title={blank ? "This cannot be empty. It is not saved until you type something." : undefined}
      placeholder={blank ? "This cannot be empty" : placeholder}
      onChange={(event) => onChange(event.target.value)}
      className={clsx(
        "-mx-2 block w-[calc(100%+1rem)] resize-none overflow-hidden rounded-md border border-transparent bg-transparent px-2 py-1 leading-relaxed placeholder:text-slate-400",
        "aria-[invalid=true]:border-red-400 aria-[invalid=true]:bg-red-50/60 hover:border-slate-300 focus:border-indigo-500 focus:bg-surface focus:outline-none focus:ring-2 focus:ring-indigo-200 disabled:cursor-not-allowed disabled:opacity-60",
        className,
      )}
    />
  );
}
