import { Suspense } from "react";
import WorkoutClient from "./workout-client";

export default function WorkoutPage() {
  return (
    <Suspense
      fallback={
        <div className="p-6 text-sm text-day-text-secondary">Loading workout...</div>
      }
    >
      <WorkoutClient />
    </Suspense>
  );
}
