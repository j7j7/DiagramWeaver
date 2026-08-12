"use client";

import React from "react";
import { createRoot, type Root } from "react-dom/client";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import type { DiagramData } from "@/lib/types";
import { ViewerCanvas } from "@/components/viewer/viewer-canvas";
import { StaticResolvedThemeProvider } from "@/components/theme-provider";
import {
  PRESENTATION_THUMB_FIT_VIEWPORT,
  presentationThumbnailCaptureBackground,
  waitTwoAnimationFrames,
} from "@/lib/diagram-editor/editor-support";
import { yieldToMainThread } from "@/lib/yield-to-main-thread";

let containerEl: HTMLDivElement | null = null;
let reactRoot: Root | null = null;

function ThumbnailCaptureShell({
  diagram,
  theme,
  onCaptureRoot,
}: {
  diagram: DiagramData;
  theme: "light" | "dark";
  onCaptureRoot: (root: HTMLElement) => void;
}) {
  const reportedRef = React.useRef(false);
  const hostRef = React.useCallback(
    (host: HTMLDivElement | null) => {
      if (!host || reportedRef.current) return;
      reportedRef.current = true;
      void (async () => {
        await waitTwoAnimationFrames();
        await waitTwoAnimationFrames();
        const captureRoot = host.querySelector<HTMLElement>("#canvas-container");
        if (captureRoot) onCaptureRoot(captureRoot);
      })();
    },
    [onCaptureRoot],
  );

  const thumbBg = presentationThumbnailCaptureBackground(theme);

  return (
    <div
      ref={hostRef}
      aria-hidden
      data-presentation-thumbnail-capture-host
      className="pointer-events-none fixed overflow-hidden opacity-0"
      style={{
        left: -24000,
        top: 0,
        width: PRESENTATION_THUMB_FIT_VIEWPORT.width,
        height: PRESENTATION_THUMB_FIT_VIEWPORT.height,
        zIndex: -1,
      }}
    >
      <div
        className="h-full w-full"
        style={{
          backgroundColor: thumbBg === "dark" ? "#0f172a" : "#ffffff",
        }}
      >
        <StaticResolvedThemeProvider resolvedTheme={theme}>
          <DndProvider backend={HTML5Backend}>
            <ViewerCanvas
              diagramData={diagram}
              showDotGrid={false}
              showRulers={false}
              metadataPopupsEnabled={false}
              animationConnectionsEnabled
              exportAnimationTimeSeconds={0}
              skipInitialFitToView
              viewportCullingEnabled={false}
            />
          </DndProvider>
        </StaticResolvedThemeProvider>
      </div>
    </div>
  );
}

function ensureCaptureRootContainer(): Root {
  if (typeof document === "undefined") {
    throw new Error("Thumbnail capture requires a browser environment");
  }
  if (!containerEl) {
    containerEl = document.createElement("div");
    containerEl.id = "dw-presentation-thumbnail-capture-root";
    containerEl.setAttribute("aria-hidden", "true");
    document.body.appendChild(containerEl);
    reactRoot = createRoot(containerEl);
  }
  return reactRoot!;
}

/**
 * Mount strip capture on an isolated React root so the editor canvas tree does not re-render.
 */
export async function mountPresentationThumbnailCaptureHost(
  diagram: DiagramData,
  theme: "light" | "dark",
  signal?: AbortSignal,
): Promise<HTMLElement> {
  await yieldToMainThread(signal);
  const root = ensureCaptureRootContainer();

  return new Promise<HTMLElement>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }

    let settled = false;
    const timeoutId = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error("Thumbnail capture host not ready"));
    }, 8000);

    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeoutId);
      fn();
    };

    const onCaptureRoot = (captureRoot: HTMLElement) => {
      if (signal?.aborted) {
        finish(() => reject(new DOMException("Aborted", "AbortError")));
        return;
      }
      finish(() => resolve(captureRoot));
    };

    root.render(
      <ThumbnailCaptureShell
        diagram={diagram}
        theme={theme}
        onCaptureRoot={onCaptureRoot}
      />,
    );

    signal?.addEventListener(
      "abort",
      () => {
        finish(() => reject(new DOMException("Aborted", "AbortError")));
      },
      { once: true },
    );
  });
}

export function unmountPresentationThumbnailCaptureHost(): void {
  reactRoot?.render(null);
}
