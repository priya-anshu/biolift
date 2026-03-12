"use client";

import { createContext, useContext, useEffect, useState } from "react";

type ThemeContextValue = {
  isDarkMode: boolean;
  toggleTheme: () => void;
  theme: "dark" | "light";
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return ctx;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("biolift-theme") === "dark";
  });

  useEffect(() => {
    window.localStorage.setItem("biolift-theme", isDarkMode ? "dark" : "light");
    document.documentElement.classList.toggle("dark", isDarkMode);
  }, [isDarkMode]);

  return (
    <ThemeContext.Provider
      value={{
        isDarkMode,
        toggleTheme: () => setIsDarkMode((prev) => !prev),
        theme: isDarkMode ? "dark" : "light",
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}
