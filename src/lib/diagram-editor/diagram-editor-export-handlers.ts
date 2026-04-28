import type { Dispatch, MutableRefObject, RefObject, SetStateAction } from "react";
import { flushSync } from "react-dom";
import type { DiagramData, PresentationDeck } from "@/lib/types";
import type { BreadcrumbSegment } from "@/components/editor/diagram-breadcrumb";
import type { EditorCanvasHandle } from "@/components/editor/editor-canvas";
import { sanitizeExportBasename } from "@/components/editor/export-dialog";
import type { DiagramEditorExportOptions, DiagramEditorToastFn } from "@/components/editor/diagram-editor-inner-props";
import {
  buildPresentationUnionDiagramsForPngExport,
  waitTwoAnimationFrames,
  safeClone,
} from "@/lib/diagram-editor/editor-support";
import { projectVisibleDiagram } from "@/lib/presentation-delta";
import { getPresentationDeltaMode, resolvePresentationSlideDiagrams } from "@/lib/presentation-slide-chain";

export interface CreateDiagramExportHandlersParams {
  editorRef: RefObject<EditorCanvasHandle | null>;
  toast: DiagramEditorToastFn;
  setExportDialogOpen: Dispatch<SetStateAction<boolean>>;
  setExportDialogFormat: Dispatch<SetStateAction<"png" | "gif">>;
  activeTab: { name?: string } | null | undefined;
  activeDiagramStack: BreadcrumbSegment[];
  activePresentationDeckId: string | null;
  presentationDecks: PresentationDeck[];
  presentationPersistSuppressedForExportRef: MutableRefObject<boolean>;
  activePresentationSlideId: string | null;
  setActivePresentationSlideId: Dispatch<SetStateAction<string | null>>;
  presentationDraftDiagram: DiagramData | null;
  setPresentationDraftDiagram: Dispatch<SetStateAction<DiagramData | null>>;
  tabDiagramData: DiagramData;
  presentationMasterDiagram: DiagramData | null;
  diagramDataForExportLayersRef: MutableRefObject<DiagramData>;
}

export interface DiagramExportHandlers {
  handleExportPng: () => Promise<void>;
  handleExportGif: () => Promise<void>;
  handleExport: (options: DiagramEditorExportOptions) => Promise<void>;
}

/**
 * PNG/GIF export — new handlers each call (same as inline `const handleExport = async`).
 * No React hooks: safe to build from `DiagramEditor` render without changing hook order.
 */
export function createDiagramExportHandlers({
  editorRef,
  toast,
  setExportDialogOpen,
  setExportDialogFormat,
  activeTab,
  activeDiagramStack,
  activePresentationDeckId,
  presentationDecks,
  presentationPersistSuppressedForExportRef,
  activePresentationSlideId,
  setActivePresentationSlideId,
  presentationDraftDiagram,
  setPresentationDraftDiagram,
  tabDiagramData,
  presentationMasterDiagram,
  diagramDataForExportLayersRef,
}: CreateDiagramExportHandlersParams): DiagramExportHandlers {
  const handleExportPng = async () => {
    setExportDialogFormat("png");
    setExportDialogOpen(true);
  };

  const handleExportGif = async () => {
    setExportDialogFormat("gif");
    setExportDialogOpen(true);
  };

  const handleExport = async (options: DiagramEditorExportOptions) => {
    setExportDialogOpen(false);
    if (!editorRef.current) return;

    if (options.format === "gif") {
      await editorRef.current.exportGif({
        backgroundColor: options.backgroundColor,
        quality: options.quality || "medium",
        fps: options.fps,
        durationSeconds: options.durationSeconds,
      });
      return;
    }

    const basename =
      sanitizeExportBasename(options.exportBasename?.trim() || activeTab?.name || "diagram") ||
      "diagram";

    const deck =
      activeDiagramStack.length === 0 && activePresentationDeckId
        ? presentationDecks.find((d) => d.id === activePresentationDeckId)
        : null;
    const totalSlides = deck ? deck.slides.length : 0;
    const wantMulti = Boolean(
      options.pngSlideNumbers &&
        options.pngSlideNumbers.length > 0 &&
        deck &&
        totalSlides >= 1,
    );

    if (wantMulti && deck && totalSlides >= 1) {
      const indices = [...new Set(options.pngSlideNumbers!)].filter(
        (n) => Number.isInteger(n) && n >= 1 && n <= totalSlides,
      );
      if (indices.length === 0) {
        toast({
          variant: "destructive",
          title: "Export cancelled",
          description: "No valid slides in range.",
        });
        return;
      }
      indices.sort((a, b) => a - b);

      const savedSlideId = activePresentationSlideId;
      const savedDraft = presentationDraftDiagram;
      presentationPersistSuppressedForExportRef.current = true;

      const blobs: { slideNumber: number; blob: Blob }[] = [];

      try {
        for (const slideNum of indices) {
          let activeIdForUnion: string | null = null;
          let draftForUnion: DiagramData | null = null;

          const slide = deck.slides[slideNum - 1];
          if (!slide) continue;
          const masterBase = projectVisibleDiagram(
            presentationMasterDiagram ?? tabDiagramData,
          );
          const deltaMode = getPresentationDeltaMode(deck);
          const slideResolvedIndex = slideNum - 1;
          if (deck.slides[0]?.id === slide.id) {
            flushSync(() => {
              setActivePresentationSlideId(slide.id);
              setPresentationDraftDiagram(null);
            });
            activeIdForUnion = slide.id;
            draftForUnion = null;
          } else {
            const resolved =
              savedSlideId === slide.id && savedDraft
                ? savedDraft
                : resolvePresentationSlideDiagrams(masterBase, deck.slides, deltaMode)[slideResolvedIndex];
            activeIdForUnion = slide.id;
            draftForUnion = resolved;
            flushSync(() => {
              setActivePresentationSlideId(slide.id);
              setPresentationDraftDiagram(safeClone(resolved));
            });
          }

          await waitTwoAnimationFrames();

          const unionDiagrams = buildPresentationUnionDiagramsForPngExport({
            tabDiagram: tabDiagramData,
            presentationMaster: presentationMasterDiagram,
            deckSlides: deck.slides,
            activeSlideId: activeIdForUnion,
            draft: draftForUnion,
            layersFilteredBase: diagramDataForExportLayersRef.current,
            presentationDeltaMode: deltaMode,
          });

          const dataUrl = await editorRef.current.captureSnapshotPng({
            backgroundColor: options.backgroundColor,
            quality: options.quality || "medium",
            fitContent: true,
            unionDiagrams,
          });
          const blob = await (await fetch(dataUrl)).blob();
          blobs.push({ slideNumber: slideNum, blob });
        }
      } catch (err) {
        blobs.length = 0;
        console.error("Multi-slide PNG export failed:", err);
        toast({
          variant: "destructive",
          title: "Export failed",
          description: "Could not export one or more slides.",
        });
      } finally {
        flushSync(() => {
          setActivePresentationSlideId(savedSlideId);
          setPresentationDraftDiagram(savedDraft);
        });
        presentationPersistSuppressedForExportRef.current = false;
      }

      if (blobs.length === 0) return;

      const writeViaDirectoryPicker = async (): Promise<boolean> => {
        const w = window as Window & {
          showDirectoryPicker?: () => Promise<FileSystemDirectoryHandle>;
        };
        if (typeof w.showDirectoryPicker !== "function") return false;
        try {
          const dir = await w.showDirectoryPicker();
          for (const { slideNumber, blob } of blobs) {
            const name = `${basename}-${slideNumber}.png`;
            const fh = await dir.getFileHandle(name, { create: true });
            const writable = await fh.createWritable();
            await writable.write(blob);
            await writable.close();
          }
          return true;
        } catch (e: unknown) {
          if (
            e &&
            typeof e === "object" &&
            (e as { name?: string }).name === "AbortError"
          )
            return false;
          return false;
        }
      };

      if (blobs.length === 1) {
        const { slideNumber, blob } = blobs[0]!;
        const suggestedName = `${basename}-${slideNumber}.png`;
        if (typeof window.showSaveFilePicker === "function") {
          try {
            const handle = await window.showSaveFilePicker({
              suggestedName,
              types: [
                {
                  description: "PNG Images",
                  accept: { "image/png": [".png"] },
                },
              ],
            });
            const writable = await handle.createWritable();
            await writable.write(blob);
            await writable.close();
            toast({ title: "Exported", description: `${suggestedName} saved.` });
            return;
          } catch (e: unknown) {
            if (
              e &&
              typeof e === "object" &&
              (e as { name?: string }).name === "AbortError"
            )
              return;
          }
        }
        const link = document.createElement("a");
        link.download = suggestedName;
        link.href = URL.createObjectURL(blob);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
        toast({
          title: "Exported",
          description: `${suggestedName} downloaded.`,
        });
        return;
      }

      if (await writeViaDirectoryPicker()) {
        toast({
          title: "Exported",
          description: `${blobs.length} PNG files saved (${basename}-#.png).`,
        });
        return;
      }

      for (const { slideNumber, blob } of blobs) {
        const name = `${basename}-${slideNumber}.png`;
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.download = name;
        link.href = url;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }
      toast({
        title: "Exported",
        description: `${blobs.length} PNG files downloaded (${basename}-#.png).`,
      });
      return;
    }

    await editorRef.current.exportPng({
      backgroundColor: options.backgroundColor,
      quality: options.quality || "medium",
    });
  };

  return {
    handleExportPng,
    handleExportGif,
    handleExport,
  };
}
