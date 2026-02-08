"use client";

import { motion } from "framer-motion";
import clsx from "clsx";

type ButtonProps = {
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "outline" | "danger";
  size?: "sm" | "md" | "lg" | "xl";
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: "left" | "right";
  className?: string;
  onClick?: () => void;
  type?: "button" | "submit" | "reset";
  fullWidth?: boolean;
};

export default function Button({
  children,
  variant = "primary",
  size = "md",
  disabled = false,
  loading = false,
  icon,
  iconPosition = "left",
  className = "",
  onClick,
  type = "button",
  fullWidth = false,
  ...props
}: ButtonProps) {
  const baseClasses =
    "inline-flex items-center justify-center font-semibold rounded-lg transition-all duration-300 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed";

  const variants: Record<string, string> = {
    primary:
      "bg-day-accent-primary dark:bg-night-accent text-white hover:shadow-glow-blue dark:hover:shadow-glow",
    secondary: "bg-day-accent-secondary text-white hover:shadow-glow",
    ghost:
      "bg-transparent border border-day-border dark:border-night-border text-day-text-primary dark:text-night-text-primary hover:bg-day-hover dark:hover:bg-night-hover",
    outline:
      "bg-transparent border-2 border-day-accent-primary dark:border-night-accent text-day-accent-primary dark:text-night-accent hover:bg-day-accent-primary dark:hover:bg-night-accent hover:text-white",
    danger: "bg-red-600 text-white hover:bg-red-700",
  };

  const sizes: Record<string, string> = {
    sm: "px-3 py-2 text-sm",
    md: "px-4 py-2 text-base",
    lg: "px-6 py-3 text-lg",
    xl: "px-8 py-4 text-xl",
  };

  const classes = clsx(
    baseClasses,
    variants[variant],
    sizes[size],
    fullWidth && "w-full",
    className,
  );

  return (
    <motion.button
      whileHover={{ scale: disabled ? 1 : 1.02 }}
      whileTap={{ scale: disabled ? 1 : 0.98 }}
      className={classes}
      onClick={onClick}
      disabled={disabled || loading}
      type={type}
      {...props}
    >
      {loading ? (
        <motion.span
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="mr-2 h-4 w-4 rounded-full border-2 border-current border-t-transparent"
        />
      ) : null}
      {!loading && icon && iconPosition === "left" ? (
        <span className="mr-2">{icon}</span>
      ) : null}
      {children}
      {!loading && icon && iconPosition === "right" ? (
        <span className="ml-2">{icon}</span>
      ) : null}
    </motion.button>
  );
}

