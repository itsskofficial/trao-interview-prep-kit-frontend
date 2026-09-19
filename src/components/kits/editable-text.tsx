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
}

/**
 * Text that is always editable in place: no edit mode, no save button. It reads like text until it
 * is hovered or focused, grows with its content, and is reached with Tab like any other field.
 */
export function EditableText({ value, onChange, label, placeholder, className, maxLength, disabled }: EditableTextProps) {
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
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
      className={clsx(
        "-mx-2 block w-[calc(100%+1rem)] resize-none overflow-hidden rounded-md border border-transparent bg-transparent px-2 py-1 leading-relaxed placeholder:text-slate-400",
        "hover:border-slate-300 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200 disabled:cursor-not-allowed disabled:opacity-60",
        className,
      )}
    />
  );
}
