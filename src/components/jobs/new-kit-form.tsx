"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { api, ApiError } from "@/lib/api";
import type { StartOutcome } from "@/lib/types";
import { Alert, Button, Card, Field, Input, Textarea } from "../ui/primitives";

const MAX_DESCRIPTION = 50_000;

/** Paste a description, name the company, say how many days: the single-role path. */
export function NewKitForm() {
  const router = useRouter();
  const [jd, setJd] = useState("");
  const [companyUrl, setCompanyUrl] = useState("");
  const [days, setDays] = useState("5");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [existingKitId, setExistingKitId] = useState<string | null>(null);

  async function submit(event: FormEvent | null, fresh = false) {
    event?.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const url = /^https?:\/\//i.test(companyUrl.trim()) ? companyUrl.trim() : `https://${companyUrl.trim()}`;
      const result = await api<StartOutcome>("/jobs", { method: "POST", body: { jd, company_url: url, days: Number(days), fresh } });
      if (result.outcome === "kit_exists") {
        setExistingKitId(result.kitId);
        setBusy(false);
        return;
      }
      // "already_running" lands on the same progress page as "started": the second click joins the first.
      router.push(`/jobs/${result.job.id}`);
    } catch (failure) {
      setError(failure instanceof ApiError ? failure : new ApiError(0, "UNKNOWN", "Something went wrong. Try again."));
      setBusy(false);
    }
  }

  const fields = error?.fields ?? {};
  const general = error && Object.keys(fields).length === 0 ? error.message : null;

  return (
    <Card className="p-5">
      <form onSubmit={(event) => void submit(event)} noValidate className="space-y-5">
        {general && <Alert tone="error">{general}</Alert>}
        {existingKitId && (
          <Alert
            tone="info"
            title="You already have a kit for this posting"
            action={
              <div className="flex flex-wrap gap-2">
                <Link href={`/kits/${existingKitId}`} className="inline-flex min-h-8 items-center rounded-md bg-indigo-600 px-2.5 text-sm font-medium text-white hover:bg-indigo-700">
                  Open it
                </Link>
                <Button size="sm" busy={busy} onClick={() => void submit(null, true)}>
                  Generate a fresh one
                </Button>
              </div>
            }
          >
            Opening it keeps your edits and practice progress. A fresh one starts from scratch beside it.
          </Alert>
        )}

        <Field id="jd" label="Job description" hint={`Paste the full posting. ${jd.length.toLocaleString()} / ${MAX_DESCRIPTION.toLocaleString()} characters.`} error={fields.jd}>
          {(props) => <Textarea {...props} rows={12} required maxLength={MAX_DESCRIPTION} value={jd} onChange={(e) => setJd(e.target.value)} placeholder={"Senior Backend Engineer\n\nRequirements\n- 5+ years with Node.js\n..."} />}
        </Field>

        <div className="grid gap-5 sm:grid-cols-[1fr_10rem]">
          <Field id="company_url" label="Company website" hint="The homepage is enough; the app finds the careers and hiring pages itself." error={fields.company_url}>
            {(props) => <Input {...props} type="url" inputMode="url" required value={companyUrl} onChange={(e) => setCompanyUrl(e.target.value)} placeholder="https://company.com" />}
          </Field>
          <Field id="days" label="Days until the interview" error={fields.days}>
            {(props) => <Input {...props} type="number" inputMode="numeric" min={1} max={365} required value={days} onChange={(e) => setDays(e.target.value)} />}
          </Field>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" variant="primary" busy={busy && !existingKitId} disabled={jd.trim().length === 0 || companyUrl.trim().length === 0}>
            Generate kit
          </Button>
          <p className="text-sm text-slate-600">Takes one to two minutes. You can watch each step.</p>
        </div>
      </form>
    </Card>
  );
}
