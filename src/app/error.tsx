"use client";

import Link from "next/link";
import { useEffect } from "react";
import { LogoMark } from "@/components/ui/logo";
import { Button } from "@/components/ui/primitives";

/** The last line of defence: an unexpected error in a page lands here instead of on a blank screen. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset(): void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main id="main" className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-4 text-center">
      <LogoMark className="h-10 w-10" />
      <h1 className="mt-6 text-2xl font-semibold tracking-tight">Something went wrong on this page</h1>
      <p className="mt-2 text-slate-600">Your kits are safe: every change is saved as you make it. Try again, or go back to your kits.</p>
      <div className="mt-6 flex gap-2">
        <Button variant="primary" onClick={reset}>
          Try again
        </Button>
        <Link href="/" className="inline-flex min-h-10 items-center rounded-lg border border-slate-200 bg-surface px-4 text-sm font-medium text-slate-800 shadow-sm hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600">
          My kits
        </Link>
      </div>
    </main>
  );
}
