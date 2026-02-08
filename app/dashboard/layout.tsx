import type { ReactNode } from "react";
import DashboardHeader from "./ui/DashboardHeader";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-day-bg text-day-text-primary dark:bg-night-bg dark:text-night-text-primary">
      <DashboardHeader />
      <main className="mx-auto w-full max-w-7xl px-8 py-10">{children}</main>
    </div>
  );
}
