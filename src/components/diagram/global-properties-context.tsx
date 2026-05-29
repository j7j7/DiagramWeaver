"use client";

import React, { createContext, useContext, useMemo } from "react";
import {
  resolveGlobalVariables,
  resolveGlobalVariablesInRuns,
} from "@/lib/global-properties";
import type { RichTextRun } from "@/lib/types";

const GlobalPropertiesContext = createContext<Record<string, string>>({});

export function GlobalPropertiesProvider({
  globalProperties,
  children,
}: {
  globalProperties?: Record<string, string>;
  children: React.ReactNode;
}) {
  const value = useMemo(
    () => globalProperties ?? {},
    [globalProperties],
  );

  return (
    <GlobalPropertiesContext.Provider value={value}>
      {children}
    </GlobalPropertiesContext.Provider>
  );
}

export function useGlobalProperties(): Record<string, string> {
  return useContext(GlobalPropertiesContext);
}

export function useResolvedGlobalText(text: string | undefined | null): string {
  const globalProperties = useGlobalProperties();
  return useMemo(
    () => resolveGlobalVariables(text ?? "", globalProperties),
    [text, globalProperties],
  );
}

export function useResolvedGlobalRuns(runs: RichTextRun[]): RichTextRun[] {
  const globalProperties = useGlobalProperties();
  return useMemo(
    () => resolveGlobalVariablesInRuns(runs, globalProperties),
    [runs, globalProperties],
  );
}
