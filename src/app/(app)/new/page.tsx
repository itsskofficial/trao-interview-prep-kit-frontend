import type { Metadata } from "next";
import { BatchUpload } from "@/components/jobs/batch-upload";
import { NewKitForm } from "@/components/jobs/new-kit-form";

export const metadata: Metadata = { title: "New kit" };

export default function NewKitPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">New kit</h1>
        <p className="mt-1 text-sm text-slate-600">
          The app reads the posting, crawls the company&apos;s site for how they hire, looks for public discussion of their interviews, and builds a kit from what it actually finds.
        </p>
      </header>
      <NewKitForm />
      <BatchUpload />
    </div>
  );
}
