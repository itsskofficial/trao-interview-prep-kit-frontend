import type { Metadata } from "next";
import { KitList } from "@/components/kits/kit-list";

export const metadata: Metadata = { title: "My kits" };

export default function HomePage() {
  return <KitList />;
}
