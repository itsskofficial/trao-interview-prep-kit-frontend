import type { Metadata } from "next";
import { JobProgress } from "@/components/jobs/job-progress";

export const metadata: Metadata = { title: "Generating" };

export default async function JobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div className="mx-auto max-w-2xl">
      <JobProgress id={id} />
    </div>
  );
}
