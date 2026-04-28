"use client";

import { useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import type { EditorCanvasHandle } from "@/components/editor/editor-canvas";
import type { DiagramData } from "@/lib/types";
import type { SelectedItem } from "@/components/editor/diagram-editor-types";
import { isEventFromEditableElement } from "@/lib/keyboard-utils";

export interface UseDiagramEditorKeyboardParams {
  jsonPanelOpen: boolean;
  historyIndex: number;
  history: string[];
  selectedItem: SelectedItem | null;
  selectedItemIds: Set<string>;
  diagramData: DiagramData;
  setDiagramData: (updater: DiagramData | ((prev: DiagramData) => DiagramData)) => void;
  setSelectedItem: (
    updater: SelectedItem | null | ((prev: SelectedItem | null) => SelectedItem | null),
  ) => void;
  setSelectedItemIds: (updater: Set<string> | ((prev: Set<string>) => Set<string>)) => void;
  animationConnectionsEnabled: boolean;
  setAnimationConnectionsUserEnabled: Dispatch<SetStateAction<boolean>>;
  animationToggleOnClickEnabled: boolean;
  setAnimationToggleOnClickEnabled: Dispatch<SetStateAction<boolean>>;
  isReadOnly: boolean;
  handleItemDelete: (item: SelectedItem) => void;
  handleMenuCopy: () => void;
  handleMenuPaste: () => void;
  presentationPlayerOpen: boolean;
  handleEnterPresentationPlayMode: () => void;
  simulationModeEnabled: boolean;
  handleToggleSimulationMode: () => void;
  toggleJsonPanel: () => void;
  handleNew: () => void;
  handleLoadClick: () => void;
  handleSave: () => void;
  undo: () => void;
  redo: () => void;
  handleSelectAll: () => void;
  editorRef: MutableRefObject<EditorCanvasHandle | null>;
  handleGroupItems: () => void;
  handleUngroupItems: () => void;
  handleAutoLayout: () => void;
}

/**
 * Global window `keydown` shortcuts for the diagram editor (same behavior as previous inline effect).
 */
export function useDiagramEditorKeyboard(p: UseDiagramEditorKeyboardParams): void {
  const {
    jsonPanelOpen,
    historyIndex,
    history,
    selectedItem,
    selectedItemIds,
    diagramData,
    setDiagramData,
    setSelectedItem,
    setSelectedItemIds,
    animationConnectionsEnabled,
    setAnimationConnectionsUserEnabled,
    setAnimationToggleOnClickEnabled,
    isReadOnly,
    handleItemDelete,
    handleMenuCopy,
    handleMenuPaste,
    presentationPlayerOpen,
    handleEnterPresentationPlayMode,
    simulationModeEnabled,
    handleToggleSimulationMode,
    toggleJsonPanel,
    handleNew,
    handleLoadClick,
    handleSave,
    undo,
    redo,
    handleSelectAll,
    editorRef,
    handleGroupItems,
    handleUngroupItems,
    handleAutoLayout,
    animationToggleOnClickEnabled,
  } = p;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.userAgent.toUpperCase().includes("MAC");

      if (isEventFromEditableElement(e)) return;

      if ((isMac ? e.metaKey : e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "j") {
        e.preventDefault();
        toggleJsonPanel();
      }

      if ((isMac ? e.metaKey : e.ctrlKey) && e.key.toLowerCase() === "n" && !e.shiftKey) {
        e.preventDefault();
        handleNew();
      }

      if ((isMac ? e.metaKey : e.ctrlKey) && e.key.toLowerCase() === "o" && !e.shiftKey) {
        e.preventDefault();
        handleLoadClick();
      }

      if ((isMac ? e.metaKey : e.ctrlKey) && e.key.toLowerCase() === "s" && !e.shiftKey) {
        e.preventDefault();
        handleSave();
      }

      if ((isMac ? e.metaKey : e.ctrlKey) && e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      }

      if ((isMac ? e.metaKey : e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "z") {
        e.preventDefault();
        redo();
      }

      if ((isMac ? e.metaKey : e.ctrlKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
      }

      if ((isMac ? e.metaKey : e.ctrlKey) && e.key.toLowerCase() === "a" && !e.shiftKey) {
        e.preventDefault();
        handleSelectAll();
      }

      if ((isMac ? e.metaKey : e.ctrlKey) && e.key.toLowerCase() === "c" && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        handleMenuCopy();
        return;
      }

      if ((isMac ? e.metaKey : e.ctrlKey) && e.key.toLowerCase() === "v" && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        handleMenuPaste();
        return;
      }

      if ((isMac ? e.metaKey : e.ctrlKey) && e.key === "0" && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        editorRef.current?.fitToView();
        return;
      }

      if (e.key === "Escape" && selectedItemIds.size > 1) {
        e.preventDefault();
        setSelectedItemIds(new Set());
        return;
      }

      if ((e.key === "Delete" || e.key === "Backspace") && selectedItem && !isReadOnly) {
        if (selectedItemIds.size > 1) {
          return;
        }
        e.preventDefault();
        handleItemDelete(selectedItem);
        return;
      }

      if ((isMac ? e.metaKey : e.ctrlKey) && e.key.toLowerCase() === "g" && !e.shiftKey) {
        e.preventDefault();
        handleGroupItems();
        return;
      }

      if ((isMac ? e.metaKey : e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "g") {
        e.preventDefault();
        handleUngroupItems();
        return;
      }

      if ((isMac ? e.metaKey : e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "l") {
        e.preventDefault();
        handleAutoLayout();
        return;
      }

      if ((isMac ? e.metaKey : e.ctrlKey) && e.altKey && e.key.toLowerCase() === "a") {
        e.preventDefault();
        setAnimationConnectionsUserEnabled((v) => !v);
        return;
      }

      if ((isMac ? e.metaKey : e.ctrlKey) && e.altKey && e.key.toLowerCase() === "c") {
        e.preventDefault();
        if (animationConnectionsEnabled) {
          setAnimationToggleOnClickEnabled(!animationToggleOnClickEnabled);
        }
        return;
      }

      if ((isMac ? e.metaKey : e.ctrlKey) && e.altKey && e.key.toLowerCase() === "p") {
        e.preventDefault();
        if (!presentationPlayerOpen) {
          handleEnterPresentationPlayMode();
        }
        return;
      }

      if (!e.ctrlKey && !e.metaKey && !e.shiftKey && e.altKey && e.key.toLowerCase() === "s") {
        if (simulationModeEnabled) {
          e.preventDefault();
          handleToggleSimulationMode();
        }
        return;
      }

      if ((isMac ? e.metaKey : e.ctrlKey) && e.altKey && e.key.toLowerCase() === "s") {
        e.preventDefault();
        handleToggleSimulationMode();
        return;
      }

      if (
        (e.key === "ArrowUp" || e.key === "ArrowDown" || e.key === "ArrowLeft" || e.key === "ArrowRight") &&
        selectedItem &&
        selectedItem.itemType !== "edge"
      ) {
        e.preventDefault();

        const gridSize = 10;
        let deltaX = 0;
        let deltaY = 0;

        switch (e.key) {
          case "ArrowUp":
            deltaY -= gridSize;
            break;
          case "ArrowDown":
            deltaY += gridSize;
            break;
          case "ArrowLeft":
            deltaX -= gridSize;
            break;
          case "ArrowRight":
            deltaX += gridSize;
            break;
        }

        const itemIdsToMove = selectedItemIds.size > 0 ? Array.from(selectedItemIds) : [selectedItem.id];

        const unlockedItemIds = itemIdsToMove.filter((id) => {
          const node = diagramData.nodes.find((n) => n.id === id);
          return !node || !node.locked;
        });

        if (unlockedItemIds.length === 0) {
          return;
        }

        setDiagramData((prevData) => {
          const newNodes = [...prevData.nodes];
          unlockedItemIds.forEach((id) => {
            const nodeIndex = newNodes.findIndex((n) => n.id === id);
            if (nodeIndex !== -1) {
              const node = newNodes[nodeIndex];
              newNodes[nodeIndex] = {
                ...node,
                x: Math.round(((node.x || 0) + deltaX) / gridSize) * gridSize,
                y: Math.round(((node.y || 0) + deltaY) / gridSize) * gridSize,
              };
            }
          });
          return { ...prevData, nodes: newNodes };
        });

        const updatedSelectedItems: SelectedItem[] = [];
        unlockedItemIds.forEach((id) => {
          const updatedNode = diagramData.nodes.find((n) => n.id === id);
          if (updatedNode) {
            updatedSelectedItems.push({
              ...updatedNode,
              itemType: "node",
              x: Math.round(((updatedNode.x || 0) + deltaX) / gridSize) * gridSize,
              y: Math.round(((updatedNode.y || 0) + deltaY) / gridSize) * gridSize,
            } as SelectedItem);
          }
        });

        const updatedPrimary = updatedSelectedItems.find((item) => item.id === selectedItem.id);
        if (updatedPrimary) {
          setSelectedItem(updatedPrimary);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    jsonPanelOpen,
    historyIndex,
    history,
    selectedItem,
    selectedItemIds,
    diagramData,
    setDiagramData,
    setSelectedItem,
    animationConnectionsEnabled,
    setAnimationConnectionsUserEnabled,
    setAnimationToggleOnClickEnabled,
    isReadOnly,
    handleItemDelete,
    handleMenuCopy,
    handleMenuPaste,
    presentationPlayerOpen,
    handleEnterPresentationPlayMode,
    simulationModeEnabled,
    handleToggleSimulationMode,
    toggleJsonPanel,
    handleNew,
    handleLoadClick,
    handleSave,
    undo,
    redo,
    handleSelectAll,
    editorRef,
    handleGroupItems,
    handleUngroupItems,
    handleAutoLayout,
    setSelectedItemIds,
    animationToggleOnClickEnabled,
  ]);
}
