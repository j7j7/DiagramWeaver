"use client";

import React, { createContext, useContext, useMemo } from "react";
import {
  mergeGlobalProperties,
  type GlobalVariableContext,
} from "@/lib/builtin-global-variables";
import {
  resolveGlobalVariables,
  resolveGlobalVariablesInRuns,
} from "@/lib/global-properties";
import type { RichTextRun } from "@/lib/types";

const UserGlobalPropertiesContext = createContext<Record<string, string>>({});
const GlobalVariableContextState = createContext<GlobalVariableContext>({});
const EffectiveGlobalPropertiesContext = createContext<Record<string, string>>({});

export function GlobalPropertiesProvider({
  globalProperties,
  variableContext,
  children,
}: {
  globalProperties?: Record<string, string>;
  variableContext?: GlobalVariableContext;
  children: React.ReactNode;
}) {
  const userProperties = useMemo(() => globalProperties ?? {}, [globalProperties]);
  const resolvedContext = useMemo(() => variableContext ?? {}, [variableContext]);
  const effectiveProperties = useMemo(
    () => mergeGlobalProperties(userProperties, resolvedContext),
    [userProperties, resolvedContext],
  );

  return (
    <UserGlobalPropertiesContext.Provider value={userProperties}>
      <GlobalVariableContextState.Provider value={resolvedContext}>
        <EffectiveGlobalPropertiesContext.Provider value={effectiveProperties}>
          {children}
        </EffectiveGlobalPropertiesContext.Provider>
      </GlobalVariableContextState.Provider>
    </UserGlobalPropertiesContext.Provider>
  );
}

/** Built-ins merged with diagram `globalProperties` (for display resolution). */
export function useGlobalProperties(): Record<string, string> {
  return useContext(EffectiveGlobalPropertiesContext);
}

/** Diagram JSON `globalProperties` only (for chart expression save/eval with context). */
export function useUserGlobalProperties(): Record<string, string> {
  return useContext(UserGlobalPropertiesContext);
}

export function useGlobalVariableContext(): GlobalVariableContext {
  return useContext(GlobalVariableContextState);
}

export function useResolvedGlobalText(text: string | undefined | null): string {
  const effectiveProperties = useGlobalProperties();
  const variableContext = useGlobalVariableContext();
  return useMemo(
    () => resolveGlobalVariables(text ?? "", effectiveProperties, variableContext),
    [text, effectiveProperties, variableContext],
  );
}

export function useResolvedGlobalRuns(runs: RichTextRun[]): RichTextRun[] {
  const effectiveProperties = useGlobalProperties();
  const variableContext = useGlobalVariableContext();
  return useMemo(
    () => resolveGlobalVariablesInRuns(runs, effectiveProperties, variableContext),
    [runs, effectiveProperties, variableContext],
  );
}
