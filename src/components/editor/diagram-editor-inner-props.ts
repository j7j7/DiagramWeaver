import type * as React from "react";
import type { DiagramConnectionData } from "@/lib/types";

export interface ConnectionContextModalState {
  visible: boolean;
  x: number;
  y: number;
  connection: DiagramConnectionData | null;
}

export interface UmlOrChartModalState {
  visible: boolean;
  x: number;
  y: number;
  itemId: string;
}

export interface ConnectorLineFocusedVertex {
  nodeId: string;
  vertexIndex: number;
}

/** Options passed from `ExportDialog` to `handleExport`. */
export interface DiagramEditorExportOptions {
  format: "png" | "gif";
  backgroundColor: "transparent" | "white" | "dark";
  quality?: "low" | "medium" | "high";
  fps?: number;
  durationSeconds?: number;
  /** 1-based slide indices matching deck order (slide 1 = main diagram). */
  pngSlideNumbers?: number[];
  exportBasename?: string;
  /** When true, only export selected items instead of the full canvas. */
  selectionOnly?: boolean;
}

/**
 * Toast API from `useToast()` / shadcn — keep permissive for host bundle compatibility.
 */
export type DiagramEditorToastFn = (
  props: {
    title?: React.ReactNode;
    description?: React.ReactNode;
    variant?: "default" | "destructive" | null;
  } & Record<string, unknown>,
) => { id: string; dismiss: () => void; update: (props: unknown) => void };

/**
 * Passthrough props from `DiagramEditor` → `DiagramEditorInner` (100+ fields).
 * Runtime contract matches pre-refactor `any`; narrow incrementally via exported helpers above.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type DiagramEditorInnerProps = any;
