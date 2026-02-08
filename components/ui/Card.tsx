"use client";

import { motion } from "framer-motion";
import clsx from "clsx";

type CardProps = {
  children: React.ReactNode;
  variant?: "default" | "elevated" | "outline" | "gradient";
  hover?: boolean;
  className?: string;
  onClick?: () => void;
  padding?: string;
};

export default function Card({
  children,
  variant = "default",
  hover = false,
  className = "",
  onClick,
  padding = "p-6",
  ...props
}: CardProps) {
  const baseClasses = "rounded-xl border transition-all duration-300";

  const variants: Record<string, string> = {
    default:
      "bg-day-card dark:bg-night-card border-day-border dark:border-night-border shadow-card dark:shadow-card-dark",
    elevated:
      "bg-day-card dark:bg-night-card border-day-border dark:border-night-border shadow-lg dark:shadow-xl",
    outline: "bg-transparent border-2 border-day-border dark:border-night-border",
    gradient:
      "bg-gradient-to-br from-day-accent-primary to-day-accent-secondary dark:from-night-accent dark:to-red-600 text-white border-transparent",
  };

  const hoverClasses = hover
    ? "hover:shadow-lg dark:hover:shadow-xl hover:-translate-y-1 cursor-pointer"
    : "";

  const classes = clsx(baseClasses, variants[variant], hoverClasses, padding, className);

  const CardComponent = onClick ? motion.div : "div";
  const cardProps = onClick
    ? {
        whileHover: { scale: 1.02 },
        whileTap: { scale: 0.98 },
        onClick,
      }
    : {};

  return (
    <CardComponent className={classes} {...cardProps} {...props}>
      {children}
    </CardComponent>
  );
}

