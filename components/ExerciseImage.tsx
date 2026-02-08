"use client";

import { useEffect, useState } from "react";
import { Dumbbell } from "lucide-react";

type ExerciseImageProps = {
  exerciseName: string;
  className?: string;
  showFallback?: boolean;
  animate?: boolean;
  animationSpeed?: number;
  isStatic?: boolean;
};

const exerciseNameMapping: Record<string, string> = {};
const exerciseMediaEnabled = false;

export default function ExerciseImage({
  exerciseName,
  className = "",
  showFallback = true,
  animate = true,
  animationSpeed = 2000,
  isStatic = false,
}: ExerciseImageProps) {
  const [imageError, setImageError] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const directoryName = exerciseMediaEnabled
    ? exerciseNameMapping[exerciseName]
    : null;
  const imagePaths = directoryName
    ? {
        image0: `/exercises/${directoryName}/0.jpg`,
        image1: `/exercises/${directoryName}/1.jpg`,
      }
    : null;

  const currentImagePath = imagePaths
    ? isStatic
      ? imagePaths.image0
      : imagePaths[`image${currentImageIndex}` as "image0" | "image1"]
    : null;

  useEffect(() => {
    if (isStatic || !animate || !imagePaths) return;

    const interval = setInterval(() => {
      setCurrentImageIndex((prev) => (prev === 0 ? 1 : 0));
    }, animationSpeed);

    return () => clearInterval(interval);
  }, [isStatic, animate, imagePaths, animationSpeed]);

  if (!imagePaths) {
    return showFallback ? (
      <div
        className={`flex items-center justify-center bg-linear-to-br from-day-accent-primary/10 to-day-accent-secondary/10 dark:from-night-accent/10 dark:to-red-600/10 ${className}`}
      >
        <div className="text-center">
          <Dumbbell className="mx-auto mb-2 h-8 w-8 text-day-accent-primary dark:text-night-accent" />
          <p className="text-xs text-day-text-secondary dark:text-night-text-secondary">
            {exerciseName}
          </p>
        </div>
      </div>
    ) : null;
  }

  return (
    <div className={`relative ${className}`}>
      {imageLoading ? (
        <div className="absolute inset-0 flex items-center justify-center bg-day-hover dark:bg-night-hover">
          <div className="h-6 w-6 animate-spin rounded-full border-b-2 border-day-accent-primary dark:border-night-accent" />
        </div>
      ) : null}

      {!imageError && currentImagePath ? (
        <img
          src={currentImagePath}
          alt={`${exerciseName}${isStatic ? "" : ` - Position ${currentImageIndex + 1}`}`}
          className={`h-full w-full object-cover transition-opacity duration-500 ${
            imageLoading ? "opacity-0" : "opacity-100"
          }`}
          onLoad={() => setImageLoading(false)}
          onError={() => {
            setImageError(true);
            setImageLoading(false);
          }}
        />
      ) : null}

      {imageError && showFallback ? (
        <div className="flex h-full w-full items-center justify-center bg-linear-to-br from-day-accent-primary/10 to-day-accent-secondary/10 dark:from-night-accent/10 dark:to-red-600/10">
          <div className="text-center">
            <Dumbbell className="mx-auto mb-2 h-8 w-8 text-day-accent-primary dark:text-night-accent" />
            <p className="text-xs text-day-text-secondary dark:text-night-text-secondary">
              {exerciseName}
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
