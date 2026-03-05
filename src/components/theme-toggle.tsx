"use client";

import React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface ThemeToggleProps {
  variant?: "dropdown" | "button";
  className?: string;
  showLabel?: boolean;
}

/** Dropdown with Light / Dark / System options */
export function ThemeToggle({ variant = "dropdown", className, showLabel }: ThemeToggleProps) {
  const { theme, resolvedTheme, setTheme } = useTheme();

  if (variant === "button") {
    return (
      <ThemeToggleButton className={className} showLabel={showLabel} />
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn("h-8 w-8", className)}
          aria-label="Toggle theme"
        >
          <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setTheme("light")}>
          <Sun className="mr-2 h-4 w-4" />
          Light
          {theme === "light" && <span className="ml-auto">✓</span>}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("dark")}>
          <Moon className="mr-2 h-4 w-4" />
          Dark
          {theme === "dark" && <span className="ml-auto">✓</span>}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("system")}>
          <span className="mr-2 h-4 w-4 flex items-center justify-center text-xs">◐</span>
          System
          {theme === "system" && <span className="ml-auto">✓</span>}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Simple button that toggles light/dark (no system option) */
export function ThemeToggleButton({
  className,
  showLabel,
}: {
  className?: string;
  showLabel?: boolean;
}) {
  const { resolvedTheme, toggleResolved } = useTheme();

  return (
    <Button
      variant="ghost"
      size={showLabel ? "default" : "icon"}
      className={cn(showLabel ? "gap-2" : "h-8 w-8", className)}
      onClick={toggleResolved}
      aria-label={resolvedTheme === "light" ? "Switch to dark mode" : "Switch to light mode"}
    >
      {resolvedTheme === "light" ? (
        <Moon className="h-4 w-4" />
      ) : (
        <Sun className="h-4 w-4" />
      )}
      {showLabel && (
        <span>{resolvedTheme === "light" ? "Dark" : "Light"}</span>
      )}
    </Button>
  );
}
