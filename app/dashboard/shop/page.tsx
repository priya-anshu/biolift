import { redirect } from "next/navigation";
import { getFeatureFlags } from "@/lib/features";
import ShopPageClient from "./ShopPageClient";

export const dynamic = "force-dynamic";

export default async function ShopPage() {
  const flags = await getFeatureFlags();

  if (!flags.shop.enabled) {
    redirect("/dashboard");
  }

  return <ShopPageClient />;
}
