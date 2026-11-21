"use client";

import React from "react";
import { Sun, Moon } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";

interface ThemeToggleProps {
  compact?: boolean;
  className?: string;
}

export default function ThemeToggle({ compact = false, className = "" }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme();
  const isLight = theme === "light";

  if (compact) {
    return (
      <button
        onClick={toggleTheme}
        className={`p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-[#9AA4B2] hover:text-white transition-all flex items-center justify-center shrink-0 cursor-pointer ${className}`}
        title={isLight ? "Switch to Dark Mode" : "Switch to Light Mode"}
        aria-label={isLight ? "Switch to Dark Mode" : "Switch to Light Mode"}
        id="theme-toggle-compact"
      >
        {isLight ? (
          <Moon className="w-4 h-4 text-indigo-500 transition-transform rotate-0 hover:-rotate-12" />
        ) : (
          <Sun className="w-4 h-4 text-amber-400 transition-transform rotate-0 hover:rotate-45" />
        )}
      </button>
    );
  }

  return (
    <button
      onClick={toggleTheme}
      id="theme-toggle-full"
      className={`flex items-center justify-between w-full px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-mono-code transition-all cursor-pointer ${className}`}
      title={isLight ? "Switch to Dark Mode" : "Switch to Light Mode"}
    >
      <div className="flex items-center gap-2">
        {isLight ? (
          <Sun className="w-3.5 h-3.5 text-amber-500" />
        ) : (
          <Moon className="w-3.5 h-3.5 text-blue-400" />
        )}
        <span className="text-[#9AA4B2]">{isLight ? "Light Mode" : "Dark Mode"}</span>
      </div>
      <div className="flex items-center gap-1 bg-black/40 border border-white/10 rounded-md p-0.5 text-[10px]">
        <span
          className={`px-1.5 py-0.5 rounded ${
            !isLight ? "bg-[#C8F63B] text-[#07090C] font-bold" : "text-[#626E7E]"
          }`}
        >
          DARK
        </span>
        <span
          className={`px-1.5 py-0.5 rounded ${
            isLight ? "bg-[#84CC16] text-[#07090C] font-bold" : "text-[#626E7E]"
          }`}
        >
          LIGHT
        </span>
      </div>
    </button>
  );
}
