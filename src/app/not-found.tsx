import Link from "next/link";
import { LogoMark } from "@/components/ui/logo";

export default function NotFound() {
  return (
    <main id="main" className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-4 text-center">
      <LogoMark className="h-10 w-10" />
      <h1 className="mt-6 text-2xl font-semibold tracking-tight">This page does not exist</h1>
      <p className="mt-2 text-slate-600">The address may be mistyped, or the kit may have been deleted.</p>
      <Link href="/" className="mt-6 inline-flex min-h-10 items-center rounded-lg bg-gradient-to-b from-indigo-500 to-indigo-600 px-4 text-sm font-medium text-white shadow-sm shadow-indigo-600/30 transition hover:to-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600">
        Back to my kits
      </Link>
    </main>
  );
}
