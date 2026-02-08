"use client";

import { motion } from "framer-motion";
import clsx from "clsx";

type BadgeProps = {
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "outline" | "success" | "warning" | "danger" | "info";
  size?: "sm" | "md" | "lg";
  icon?: React.ReactNode;
  className?: string;
};

export default function Badge({
  children,
  variant = "primary",
  size = "md",
  icon,
  className = "",
  ...props
}: BadgeProps) {
  const baseClasses =
    "inline-flex items-center font-medium rounded-full transition-all duration-300";

  const variants: Record<string, string> = {
    primary: "bg-day-accent-primary dark:bg-night-accent text-white",
    secondary: "bg-day-accent-secondary text-white",
    ghost:
      "bg-day-hover dark:bg-night-hover text-day-text-secondary dark:text-night-text-secondary",
    outline:
      "bg-transparent border border-day-accent-primary dark:border-night-accent text-day-accent-primary dark:text-night-accent",
    success: "bg-green-500 text-white",
    warning: "bg-yellow-500 text-white",
    danger: "bg-red-500 text-white",
    info: "bg-blue-500 text-white",
  };

  const sizes: Record<string, string> = {
    sm: "px-2 py-1 text-xs",
    md: "px-3 py-1 text-sm",
    lg: "px-4 py-2 text-base",
  };

  const classes = clsx(baseClasses, variants[variant], sizes[size], className);

  return (
    <motion.span className={classes} whileHover={{ scale: 1.05 }} {...props}>
      {icon ? <span className="mr-1">{icon}</span> : null}
      {children}
    </motion.span>
  );
}

