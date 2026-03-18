import { redirect } from "next/navigation";
import { getFeatureFlags } from "@/lib/features";
import ShopPageClient from "./ShopPageClient";

export default async function ShopPage() {
  const flags = await getFeatureFlags();

  if (!flags.shop.enabled) {
    redirect("/dashboard");
  }

  return <ShopPageClient />;
}
