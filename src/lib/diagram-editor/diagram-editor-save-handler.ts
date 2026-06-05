import type { PresentationDeck, DiagramData } from "@/lib/types";
import { ensureDiagramLayersPersisted } from "@/lib/layers-utils";
import type { DiagramJsonWithPresentations } from "@/lib/diagram-editor/editor-support";
import {
  dedupeSlideRefSets,
  buildBaseNodeMap,
  canCompressNodeReplaceToIds,
  canCompressLayerReplaceToVisibleIds,
  stripConnectionDefaults,
} from "@/lib/diagram-editor/editor-support";
import type {
  CompactDeckV2,
  CompactSlideV2,
  CompactOperation,
  CompactOpCode,
  CompactAnimationStateV2,
} from "@/lib/diagram-editor/editor-support";
import { projectVisibleDiagram } from "@/lib/presentation-delta";
import type { TabState } from "@/hooks/use-diagram-tabs";
import type { DiagramEditorToastFn } from "@/components/editor/diagram-editor-inner-props";
import { prepareDiagramDataForJsonExport } from "@/lib/user-defined-objects";

function getFilenameStem(filename: string) {
  return filename.replace(/\.[^.]+$/, "") || filename;
}

export interface CreateDiagramSaveHandlerParams {
  activeTabId: string | null;
  activeTab: TabState | null;
  getTab: (tabId: string) => TabState | null;
  updateTab: (tabId: string, updates: Partial<TabState>) => void;
  markTabAsSaved: (tabId?: string) => void;
  toast: DiagramEditorToastFn;
  presentationMasterDiagram: DiagramData | null;
  presentationDecks: PresentationDeck[];
  activePresentationDeckId: string | null;
}

/**
 * Returns save-to-JSON (compact presentations) — new function each call (same as inline `const handleSave = async`).
 * No React hooks: safe to assign from `DiagramEditor` render without changing hook order.
 */
export function createDiagramSaveHandler({
  activeTabId,
  activeTab,
  getTab,
  updateTab,
  markTabAsSaved,
  toast,
  presentationMasterDiagram,
  presentationDecks,
  activePresentationDeckId,
}: CreateDiagramSaveHandlerParams): (tabId?: string) => Promise<boolean> {
  return async (tabId?: string): Promise<boolean> => {
    const targetTabId = (typeof tabId === "string" ? tabId : undefined) ?? activeTabId;
    const targetTab = targetTabId ? getTab(targetTabId) : activeTab;
    if (!targetTabId || !targetTab) return false;

    const baseForPresentationCompression = projectVisibleDiagram(
      presentationMasterDiagram ?? targetTab.diagramData,
    );
    const baseNodeMap = buildBaseNodeMap(baseForPresentationCompression);

    const compactDecks: CompactDeckV2[] = presentationDecks.map((deck) => {
      const rawSlides: CompactSlideV2[] = deck.slides.map((slide, index) => {
        const compactRefs: CompactSlideV2["r"] = {};
        const compactOps: CompactOperation[] = [];

        for (const operation of slide.diagramDelta.operations || []) {
          if (operation.op === "replace" && operation.path === "/nodes") {
            const compressedIds = canCompressNodeReplaceToIds(operation.value, baseNodeMap);
            if (compressedIds) {
              compactRefs.n = compressedIds;
              continue;
            }
          }

          if (operation.op === "replace" && operation.path === "/layers/layers") {
            const compressedVisibleLayerIds = canCompressLayerReplaceToVisibleIds(
              operation.value,
              baseForPresentationCompression.layers,
            );
            if (compressedVisibleLayerIds) {
              compactRefs.l = compressedVisibleLayerIds;
              continue;
            }
          }

          if (
            operation.op === "replace" &&
            operation.path === "/connections" &&
            Array.isArray(operation.value)
          ) {
            compactRefs.c = (
              operation.value as DiagramData["connections"]
            ).map(stripConnectionDefaults);
            continue;
          }

          const code: CompactOpCode =
            operation.op === "add" ? 0 : operation.op === "remove" ? 1 : 2;
          compactOps.push(
            operation.value === undefined
              ? [code, operation.path]
              : [code, operation.path, operation.value],
          );
        }

        const animationState = slide.animationState;
        const compactAnimation: CompactAnimationStateV2 | undefined = animationState
          ? {
              e: animationState.enabled ? undefined : 0,
              f:
                animationState.filterSourceIds &&
                animationState.filterSourceIds.length > 0
                  ? animationState.filterSourceIds
                  : undefined,
              x:
                animationState.disabledSourceIds &&
                animationState.disabledSourceIds.length > 0
                  ? animationState.disabledSourceIds
                  : undefined,
            }
          : undefined;

        const hasCompactAnimation = Boolean(
          compactAnimation &&
            (compactAnimation.e !== undefined ||
              (compactAnimation.f && compactAnimation.f.length > 0) ||
              (compactAnimation.x && compactAnimation.x.length > 0)),
        );

        const defaultTitle = `Snapshot ${index + 1}`;
        return {
          d: compactOps.length > 0 ? { o: compactOps } : undefined,
          r: compactRefs.n || compactRefs.l || compactRefs.c ? compactRefs : undefined,
          t: slide.title && slide.title !== defaultTitle ? slide.title : undefined,
          a: hasCompactAnimation ? compactAnimation : undefined,
          z:
            typeof slide.autoZoomLevel === "number" && Number.isFinite(slide.autoZoomLevel)
              ? Number(slide.autoZoomLevel.toFixed(4))
              : undefined,
          px:
            typeof slide.viewPanX === "number" && Number.isFinite(slide.viewPanX)
              ? Number(slide.viewPanX.toFixed(2))
              : undefined,
          py:
            typeof slide.viewPanY === "number" && Number.isFinite(slide.viewPanY)
              ? Number(slide.viewPanY.toFixed(2))
              : undefined,
        };
      });

      const deduped = dedupeSlideRefSets(rawSlides);
      return {
        n: deck.name || undefined,
        tn: deduped.nodeTable,
        tl: deduped.layerTable,
        tc: deduped.connectionTable,
        s: deduped.slides,
      };
    });

    const activeDeckIndex = activePresentationDeckId
      ? presentationDecks.findIndex((deck) => deck.id === activePresentationDeckId)
      : -1;

    const dataToSave: DiagramJsonWithPresentations = {
      ...prepareDiagramDataForJsonExport(ensureDiagramLayersPersisted(targetTab.diagramData)),
      presentations: {
        v: 2,
        ai: activeDeckIndex >= 0 ? activeDeckIndex : undefined,
        d: compactDecks,
      },
    };
    const jsonString = JSON.stringify(dataToSave, null, 2);
    const suggestedName = `${targetTab.name.replace(/\s+/g, "-").toLowerCase()}.json`;

    if ("showSaveFilePicker" in window) {
      try {
        const handle = await (window as any).showSaveFilePicker({
          suggestedName,
          types: [
            {
              description: "JSON Files",
              accept: { "application/json": [".json"] },
            },
          ],
        });
        const writable = await handle.createWritable();
        await writable.write(jsonString);
        await writable.close();
        const fileName = "name" in handle ? String(handle.name) : suggestedName;
        updateTab(targetTabId, { name: getFilenameStem(fileName) });
        markTabAsSaved(targetTabId);
        toast({ title: "Diagram Saved", description: "Your diagram has been saved successfully." });
        return true;
      } catch (error: unknown) {
        if (
          error &&
          typeof error === "object" &&
          "name" in error &&
          (error as { name?: string }).name === "AbortError"
        )
          return false;
        console.log("File System Access API failed, falling back to download:", error);
      }
    }

    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = suggestedName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    updateTab(targetTabId, { name: getFilenameStem(suggestedName) });
    markTabAsSaved(targetTabId);
    toast({ title: "Diagram Saved", description: "Your diagram has been downloaded." });
    return true;
  };
}
