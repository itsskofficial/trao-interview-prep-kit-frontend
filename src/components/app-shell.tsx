"use client";

import clsx from "clsx";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { signOut, useSession } from "@/lib/session";
import { LogoMark } from "./ui/logo";
import { Button } from "./ui/primitives";
import { ServerWakingNotice } from "./ui/server-waking";

const NAV = [
  { href: "/", label: "My kits" },
  { href: "/new", label: "New kit" },
];

/** The frame around every signed-in screen: navigation, who is signed in, and the slow-server notice. */
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user } = useSession();

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/80 backdrop-blur-md print:hidden">
        <div className="mx-auto flex w-full max-w-5xl items-center gap-x-2 px-4 py-3 sm:gap-x-6">
          <Link href="/" className="flex items-center gap-2 rounded-lg font-semibold tracking-tight focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600">
            <LogoMark />
            <span className="sr-only sm:not-sr-only">Interview Prep Kit</span>
          </Link>
          <nav aria-label="Main" className="flex gap-1">
            {NAV.map((item) => {
              const current = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={current ? "page" : undefined}
                  className={clsx(
                    "rounded-md px-3 py-1.5 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600",
                    current ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            {user && <span className="hidden max-w-[16rem] truncate text-sm text-slate-600 sm:inline">{user.email}</span>}
            <Button size="sm" variant="ghost" onClick={() => void signOut()}>
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <ServerWakingNotice />

      <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:py-8">
        {children}
      </main>
    </div>
  );
}
