import type { Metadata } from "next";
import { Suspense } from "react";
import { KitPage } from "@/components/kits/kit-page";

export const metadata: Metadata = { title: "Kit" };

export default async function KitRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense>
      <KitPage id={id} />
    </Suspense>
  );
}
