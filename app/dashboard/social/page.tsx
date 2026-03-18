import { redirect } from "next/navigation";
import { getFeatureFlags } from "@/lib/features";
import SocialPageClient from "./SocialPageClient";

export default async function SocialPage() {
  const flags = await getFeatureFlags();

  if (!flags.social.enabled) {
    redirect("/dashboard");
  }

  return <SocialPageClient />;
}
