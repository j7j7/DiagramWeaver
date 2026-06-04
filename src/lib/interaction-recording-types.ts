/** DiagramWeaver interaction recording — compact JSON event log (not video). */

export const INTERACTION_RECORDING_VERSION = 1 as const;
export const INTERACTION_RECORDING_FILE_EXT = ".dwrec.json";

export type InteractionRecordingStatus = "idle" | "armed" | "recording" | "playing";

export interface InteractionRecordingModifiers {
  alt: boolean;
  ctrl: boolean;
  meta: boolean;
  shift: boolean;
}

export interface InteractionRecordingTarget {
  /** Nearest ancestor `data-testid`. */
  testId?: string;
  /** Nearest ancestor `data-node-id`. */
  nodeId?: string;
  /** Nearest ancestor `data-tutorial-id`. */
  tutorialId?: string;
  /** Resize handle id from `data-handle`. */
  handle?: string;
  /** ARIA role when useful (button, menuitem, …). */
  role?: string;
  /** Accessible name or trimmed visible text. */
  name?: string;
  /** HTML tag name of the event target. */
  tag?: string;
  /** Input/textarea placeholder — stable replay selector. */
  placeholder?: string;
  /** Visible label on palette tiles (`.cursor-move`). */
  paletteLabel?: string;
  /** Floating surface id (`data-dw-recording-surface`) — menus, panels. */
  recordingSurface?: string;
  /** Action id within a surface (`data-dw-recording-action` or slugged label). */
  recordingAction?: string;
}

export interface InteractionRecordingViewport {
  width: number;
  height: number;
  devicePixelRatio: number;
}

export interface InteractionRecordingCanvasTransform {
  x: number;
  y: number;
  k: number;
}

export interface InteractionRecordingDiagramPoint {
  x: number;
  y: number;
}

export type InteractionRecordingEvent =
  | {
      t: number;
      kind: "pointer";
      phase: "down" | "move" | "up" | "cancel";
      x: number;
      y: number;
      button: number;
      buttons: number;
      pointerId: number;
      pointerType: string;
      modifiers: InteractionRecordingModifiers;
      target: InteractionRecordingTarget;
      /** Diagram-space point when the event is over the editor canvas. */
      diagram?: InteractionRecordingDiagramPoint;
      /** Canvas pan/zoom at event time (for replay remapping). */
      canvasTransform?: InteractionRecordingCanvasTransform;
    }
  | {
      t: number;
      kind: "wheel";
      x: number;
      y: number;
      deltaX: number;
      deltaY: number;
      deltaZ: number;
      deltaMode: number;
      modifiers: InteractionRecordingModifiers;
      target: InteractionRecordingTarget;
      diagram?: InteractionRecordingDiagramPoint;
      canvasTransform?: InteractionRecordingCanvasTransform;
    }
  | {
      t: number;
      kind: "keydown" | "keyup";
      key: string;
      code: string;
      modifiers: InteractionRecordingModifiers;
      target: InteractionRecordingTarget;
    }
  | {
      t: number;
      kind: "input";
      value: string;
      inputType?: string;
      modifiers: InteractionRecordingModifiers;
      target: InteractionRecordingTarget;
    }
  | {
      t: number;
      kind: "change";
      value: string;
      modifiers: InteractionRecordingModifiers;
      target: InteractionRecordingTarget;
    }
  | {
      t: number;
      kind: "click";
      x: number;
      y: number;
      button: number;
      modifiers: InteractionRecordingModifiers;
      target: InteractionRecordingTarget;
      diagram?: InteractionRecordingDiagramPoint;
      canvasTransform?: InteractionRecordingCanvasTransform;
    }
  | {
      t: number;
      kind: "contextmenu";
      x: number;
      y: number;
      modifiers: InteractionRecordingModifiers;
      target: InteractionRecordingTarget;
      diagram?: InteractionRecordingDiagramPoint;
      canvasTransform?: InteractionRecordingCanvasTransform;
    }
  | {
      t: number;
      kind: "custom";
      name: string;
      detail: unknown;
    };

export interface InteractionRecording {
  version: typeof INTERACTION_RECORDING_VERSION;
  title: string;
  description?: string;
  recordedAt: string;
  viewport: InteractionRecordingViewport;
  /** Canvas pan/zoom at recording start. */
  canvasTransform?: InteractionRecordingCanvasTransform;
  /** Canvas pan/zoom when recording stopped. */
  canvasTransformEnd?: InteractionRecordingCanvasTransform;
  events: InteractionRecordingEvent[];
}

export interface InteractionRecordingIndexEntry {
  id: string;
  title: string;
  description?: string;
  recordedAt: string;
  eventCount: number;
  durationMs: number;
}

export interface InteractionRecordingLibraryEntry extends InteractionRecordingIndexEntry {
  recording: InteractionRecording;
}

/** Hotkeys — only active while recorder mode is armed/recording. */
export const RECORDER_START_KEY = "F8";
export const RECORDER_STOP_KEY = "F9";
