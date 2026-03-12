"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Flame } from "lucide-react";

type PersonalRecordAlertProps = {
  visible: boolean;
  exerciseName?: string | null;
  weightKg?: number | null;
  reps?: number | null;
};

export default function PersonalRecordAlert({
  visible,
  exerciseName,
  weightKg,
  reps,
}: PersonalRecordAlertProps) {
  return (
    <AnimatePresence>
      {visible ? (
        <motion.div
          initial={{ opacity: 0, y: -10, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.98 }}
          transition={{ duration: 0.2 }}
          className="fixed left-1/2 top-20 z-40 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 shadow-lg dark:border-amber-900/40 dark:bg-amber-900/30"
        >
          <div className="flex items-center gap-2 text-sm font-semibold text-amber-700 dark:text-amber-300">
            <Flame className="h-4 w-4" />
            New Personal Record
          </div>
          <div className="mt-1 text-xs text-amber-700/90 dark:text-amber-200/90">
            {exerciseName ? `${exerciseName} ` : ""}
            {weightKg !== null && weightKg !== undefined ? `${weightKg} kg` : "-"}
            {reps !== null && reps !== undefined ? ` × ${reps} reps` : ""}
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

