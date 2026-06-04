import type { InteractionRecordingCanvasTransform } from "@/lib/interaction-recording-types";

export const CANVAS_TEST_ID = "editor-canvas";

export function readLiveCanvasTransform(): InteractionRecordingCanvasTransform {
  const canvas = document.querySelector(`[data-testid="${CANVAS_TEST_ID}"]`);
  const layer = canvas?.querySelector("[data-diagram-layer]") as HTMLElement | null;
  if (!layer) return { x: 0, y: 0, k: 1 };
  const m = getComputedStyle(layer).transform;
  if (!m || m === "none") return { x: 0, y: 0, k: 1 };
  const dm = new DOMMatrix(m);
  return { x: dm.e, y: dm.f, k: dm.a || 1 };
}

export function getEditorCanvasRect(): DOMRect | null {
  const canvas = document.querySelector(`[data-testid="${CANVAS_TEST_ID}"]`);
  return canvas?.getBoundingClientRect() ?? null;
}

export function isClientPointOverCanvas(clientX: number, clientY: number): boolean {
  const rect = getEditorCanvasRect();
  if (!rect) return false;
  return (
    clientX >= rect.left &&
    clientX <= rect.right &&
    clientY >= rect.top &&
    clientY <= rect.bottom
  );
}

export function clientToDiagram(
  clientX: number,
  clientY: number,
  transform: InteractionRecordingCanvasTransform,
  rect = getEditorCanvasRect(),
): { x: number; y: number } | null {
  if (!rect) return null;
  return {
    x: (clientX - rect.left - transform.x) / transform.k,
    y: (clientY - rect.top - transform.y) / transform.k,
  };
}

export function diagramToClient(
  diagramX: number,
  diagramY: number,
  transform: InteractionRecordingCanvasTransform,
  rect = getEditorCanvasRect(),
): { x: number; y: number } | null {
  if (!rect) return null;
  return {
    x: rect.left + transform.x + diagramX * transform.k,
    y: rect.top + transform.y + diagramY * transform.k,
  };
}

/** Remap a screen point from one canvas transform to another (same diagram target). */
export function remapClientPointForCanvasTransform(
  clientX: number,
  clientY: number,
  from: InteractionRecordingCanvasTransform,
  to: InteractionRecordingCanvasTransform,
  rect = getEditorCanvasRect(),
): { x: number; y: number } | null {
  const diagram = clientToDiagram(clientX, clientY, from, rect);
  if (!diagram) return null;
  return diagramToClient(diagram.x, diagram.y, to, rect);
}

export function transformsEqual(
  a: InteractionRecordingCanvasTransform,
  b: InteractionRecordingCanvasTransform,
  epsilon = 0.01,
): boolean {
  return (
    Math.abs(a.x - b.x) < epsilon &&
    Math.abs(a.y - b.y) < epsilon &&
    Math.abs(a.k - b.k) < epsilon
  );
}

export function remapClientPointForViewportResize(
  clientX: number,
  clientY: number,
  recorded: { width: number; height: number },
  current: { width: number; height: number },
): { x: number; y: number } {
  if (recorded.width <= 0 || recorded.height <= 0) return { x: clientX, y: clientY };
  return {
    x: (clientX / recorded.width) * current.width,
    y: (clientY / recorded.height) * current.height,
  };
}

export interface ReplayPointContext {
  activeTransform: InteractionRecordingCanvasTransform;
  recordedTransform: InteractionRecordingCanvasTransform;
  recordedViewport: { width: number; height: number };
}

export function resolveReplayClientPoint(
  clientX: number,
  clientY: number,
  diagram: { x: number; y: number } | undefined,
  ctx: ReplayPointContext,
  eventTransform?: InteractionRecordingCanvasTransform,
): { x: number; y: number } {
  const currentViewport = {
    width: window.innerWidth,
    height: window.innerHeight,
  };

  if (diagram) {
    const remapped = diagramToClient(diagram.x, diagram.y, ctx.activeTransform);
    if (remapped) return remapped;
  }

  const fromTransform = eventTransform ?? ctx.activeTransform;

  if (isClientPointOverCanvas(clientX, clientY) || diagram) {
    const remapped = remapClientPointForCanvasTransform(
      clientX,
      clientY,
      fromTransform,
      ctx.activeTransform,
    );
    if (remapped) return remapped;
  }

  return remapClientPointForViewportResize(
    clientX,
    clientY,
    ctx.recordedViewport,
    currentViewport,
  );
}

export async function waitForCanvasTransform(
  expected: InteractionRecordingCanvasTransform,
  timeoutMs = 400,
  signal?: AbortSignal,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (signal?.aborted) return false;
    const live = readLiveCanvasTransform();
    if (transformsEqual(live, expected, 0.5)) return true;
    await new Promise((r) => window.setTimeout(r, 16));
  }
  return transformsEqual(readLiveCanvasTransform(), expected, 1);
}
