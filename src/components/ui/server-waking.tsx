"use client";

import { useEffect, useState } from "react";
import { onServerSlow } from "@/lib/api";

/** Free hosting sleeps when idle. A slow request says so, instead of looking like a broken page. */
export function ServerWakingNotice() {
  const [slow, setSlow] = useState(false);
  useEffect(() => onServerSlow(setSlow), []);
  if (!slow) return null;
  return (
    <div role="status" className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-sm text-amber-900 print:hidden">
      Waking the server. It runs on free hosting and sleeps when idle, so the first request can take up to a minute.
    </div>
  );
}
