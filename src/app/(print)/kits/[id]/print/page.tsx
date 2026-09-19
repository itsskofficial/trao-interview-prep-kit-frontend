import type { Metadata } from "next";
import { PrintKit } from "@/components/kits/print-kit";

export const metadata: Metadata = { title: "One-page summary" };

export default async function PrintRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PrintKit id={id} />;
}
