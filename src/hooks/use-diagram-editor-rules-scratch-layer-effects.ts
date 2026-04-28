"use client";

import { useEffect, type Dispatch, type SetStateAction } from "react";
import { getItemSafe, setItemDebounced } from "@/lib/local-storage-debounce";
import type { DiagramRule } from "@/lib/rules-types";

export interface UseDiagramEditorRulesScratchLayerEffectsParams {
  rules: DiagramRule[];
  setRules: Dispatch<SetStateAction<DiagramRule[]>>;
  scratchPadOpen: boolean;
  setScratchPadOpen: Dispatch<SetStateAction<boolean>>;
  layerAnimationsEnabled: boolean;
  setLayerAnimationsEnabled: Dispatch<SetStateAction<boolean>>;
}

/** Restore / persist diagram rules, scratchpad visibility, layer animation toggle (mirror previous inline effects). */
export function useDiagramEditorRulesScratchLayerEffects({
  rules,
  setRules,
  scratchPadOpen,
  setScratchPadOpen,
  layerAnimationsEnabled,
  setLayerAnimationsEnabled,
}: UseDiagramEditorRulesScratchLayerEffectsParams): void {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = getItemSafe("dw:rules");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const rulesArray = Array.isArray(parsed?.rules) ? parsed.rules : Array.isArray(parsed) ? parsed : [];
        if (rulesArray.length > 0 && rulesArray.every((r: unknown) => r && typeof (r as DiagramRule).id === "string" && (r as DiagramRule).operator)) {
          setRules(rulesArray);
        }
      } catch {
        // ignore
      }
    }
  }, [setRules]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setItemDebounced("dw:rules", JSON.stringify({ version: "1.0", rules }), 1000);
    }
  }, [rules]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = getItemSafe("dw:scratchpad:visible");
    if (saved) {
      try {
        setScratchPadOpen(JSON.parse(saved));
      } catch {
        // ignore
      }
    }
  }, [setScratchPadOpen]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setItemDebounced("dw:scratchpad:visible", JSON.stringify(scratchPadOpen), 1000);
    }
  }, [scratchPadOpen]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = getItemSafe("dw:layerAnimations:enabled");
    if (saved !== null) {
      try {
        setLayerAnimationsEnabled(JSON.parse(saved));
      } catch {
        // ignore
      }
    }
  }, [setLayerAnimationsEnabled]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setItemDebounced("dw:layerAnimations:enabled", JSON.stringify(layerAnimationsEnabled), 1000);
    }
  }, [layerAnimationsEnabled]);
}
