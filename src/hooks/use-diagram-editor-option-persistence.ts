"use client";

import { useEffect, type Dispatch, type SetStateAction } from "react";
import {
  LEFT_SIDEBAR_MODE_STORAGE_KEY,
  readLeftSidebarModeFromStorage,
  type LeftSidebarMode,
} from "@/lib/left-sidebar-mode";
import { getItemSafe, setBooleanDebounced, setItemDebounced } from "@/lib/local-storage-debounce";

export interface UseDiagramEditorOptionPersistenceParams {
  isClient: boolean;
  jsonPanelWidth: number;
  iconBackgroundEnabled: boolean;
  defaultTextLabelsEnabled: boolean;
  alignmentGuidesEnabled: boolean;
  dotGridEnabled: boolean;
  connectionsBehindNodesEnabled: boolean;
  animationConnectionsUserEnabled: boolean;
  animationToggleOnClickEnabled: boolean;
  simplifyFillsDuringCanvasDragEnabled: boolean;
  suppressShadowsOnAllObjectsDuringCanvasDragEnabled: boolean;
  leftSidebarMode: LeftSidebarMode;
  setRightPanelCollapsed: Dispatch<SetStateAction<boolean>>;
  setLeftSidebarMode: Dispatch<SetStateAction<LeftSidebarMode>>;
  setPropertiesPanelVisible: Dispatch<SetStateAction<boolean>>;
  setMetadataPopupsEnabled: Dispatch<SetStateAction<boolean>>;
  setAlignmentGuidesEnabled: Dispatch<SetStateAction<boolean>>;
  setDotGridEnabled: Dispatch<SetStateAction<boolean>>;
  setConnectionsBehindNodesEnabled: Dispatch<SetStateAction<boolean>>;
  setAnimationConnectionsUserEnabled: Dispatch<SetStateAction<boolean>>;
  setAnimationToggleOnClickEnabled: Dispatch<SetStateAction<boolean>>;
  setSimplifyFillsDuringCanvasDragEnabled: Dispatch<SetStateAction<boolean>>;
  setSuppressShadowsOnAllObjectsDuringCanvasDragEnabled: Dispatch<SetStateAction<boolean>>;
}

/**
 * Debounced persists for editor booleans / JSON panel width + one-shot restore of panel & canvas option keys after mount.
 */
export function useDiagramEditorOptionPersistence(p: UseDiagramEditorOptionPersistenceParams): void {
  const {
    isClient,
    jsonPanelWidth,
    iconBackgroundEnabled,
    defaultTextLabelsEnabled,
    alignmentGuidesEnabled,
    dotGridEnabled,
    connectionsBehindNodesEnabled,
    animationConnectionsUserEnabled,
    animationToggleOnClickEnabled,
    simplifyFillsDuringCanvasDragEnabled,
    suppressShadowsOnAllObjectsDuringCanvasDragEnabled,
    leftSidebarMode,
    setRightPanelCollapsed,
    setLeftSidebarMode,
    setPropertiesPanelVisible,
    setMetadataPopupsEnabled,
    setAlignmentGuidesEnabled,
    setDotGridEnabled,
    setConnectionsBehindNodesEnabled,
    setAnimationConnectionsUserEnabled,
    setAnimationToggleOnClickEnabled,
    setSimplifyFillsDuringCanvasDragEnabled,
    setSuppressShadowsOnAllObjectsDuringCanvasDragEnabled,
  } = p;

  useEffect(() => {
    if (isClient) {
      setItemDebounced("dw:jsonEditor:width", String(jsonPanelWidth), 200);
    }
  }, [jsonPanelWidth, isClient]);

  useEffect(() => {
    if (isClient) {
      setBooleanDebounced("dw:iconBackground:enabled", iconBackgroundEnabled);
    }
  }, [iconBackgroundEnabled, isClient]);

  useEffect(() => {
    if (isClient) {
      setBooleanDebounced("dw:defaultTextLabels:enabled", defaultTextLabelsEnabled);
    }
  }, [defaultTextLabelsEnabled, isClient]);

  useEffect(() => {
    if (isClient) {
      setBooleanDebounced("dw:alignmentGuides:enabled", alignmentGuidesEnabled);
    }
  }, [alignmentGuidesEnabled, isClient]);

  useEffect(() => {
    if (isClient) {
      setBooleanDebounced("dw:dotGrid:enabled", dotGridEnabled);
    }
  }, [dotGridEnabled, isClient]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const savedCollapsed = getItemSafe("dw:propertiesPanel:collapsed");
    if (savedCollapsed !== null) setRightPanelCollapsed(savedCollapsed === "true");
    const savedVisible = getItemSafe("dw:propertiesPanel:visible");
    if (savedVisible !== null) setPropertiesPanelVisible(savedVisible !== "false");
    const savedPopups = getItemSafe("dw:metadataPopups:enabled");
    if (savedPopups !== null) setMetadataPopupsEnabled(savedPopups !== "false");
    const savedGuides = getItemSafe("dw:alignmentGuides:enabled");
    if (savedGuides !== null) setAlignmentGuidesEnabled(savedGuides !== "false");
    const savedDotGrid = getItemSafe("dw:dotGrid:enabled");
    if (savedDotGrid !== null) setDotGridEnabled(savedDotGrid !== "false");
    const savedConnectionsBehind = getItemSafe("dw:connectionsBehindNodes:enabled");
    if (savedConnectionsBehind !== null) setConnectionsBehindNodesEnabled(savedConnectionsBehind !== "false");
    const savedAnimationConnections = getItemSafe("dw:animationConnections:enabled");
    if (savedAnimationConnections !== null) setAnimationConnectionsUserEnabled(savedAnimationConnections !== "false");
    const savedAnimationToggleOnClick = getItemSafe("dw:animationToggleOnClick:enabled");
    if (savedAnimationToggleOnClick !== null) setAnimationToggleOnClickEnabled(savedAnimationToggleOnClick === "true");
    const savedSimplifyFillsDrag = getItemSafe("dw:simplifyFillsDuringCanvasDrag:enabled");
    if (savedSimplifyFillsDrag !== null) {
      setSimplifyFillsDuringCanvasDragEnabled(savedSimplifyFillsDrag !== "false");
    }
    const savedSuppressAllShadowsDrag = getItemSafe(
      "dw:suppressShadowsOnAllObjectsDuringCanvasDrag:enabled",
    );
    if (savedSuppressAllShadowsDrag !== null) {
      setSuppressShadowsOnAllObjectsDuringCanvasDragEnabled(savedSuppressAllShadowsDrag !== "false");
    }
    const savedLeftSidebarMode = readLeftSidebarModeFromStorage(getItemSafe);
    if (savedLeftSidebarMode !== null) {
      setLeftSidebarMode(savedLeftSidebarMode);
    }
  }, [
    setRightPanelCollapsed,
    setLeftSidebarMode,
    setPropertiesPanelVisible,
    setMetadataPopupsEnabled,
    setAlignmentGuidesEnabled,
    setDotGridEnabled,
    setConnectionsBehindNodesEnabled,
    setAnimationConnectionsUserEnabled,
    setAnimationToggleOnClickEnabled,
    setSimplifyFillsDuringCanvasDragEnabled,
    setSuppressShadowsOnAllObjectsDuringCanvasDragEnabled,
  ]);

  useEffect(() => {
    if (isClient) {
      setBooleanDebounced("dw:connectionsBehindNodes:enabled", connectionsBehindNodesEnabled);
    }
  }, [connectionsBehindNodesEnabled, isClient]);

  useEffect(() => {
    if (isClient) {
      setBooleanDebounced("dw:animationConnections:enabled", animationConnectionsUserEnabled);
    }
  }, [animationConnectionsUserEnabled, isClient]);

  useEffect(() => {
    if (isClient) {
      setBooleanDebounced("dw:animationToggleOnClick:enabled", animationToggleOnClickEnabled);
    }
  }, [animationToggleOnClickEnabled, isClient]);

  useEffect(() => {
    if (isClient) {
      setBooleanDebounced(
        "dw:simplifyFillsDuringCanvasDrag:enabled",
        simplifyFillsDuringCanvasDragEnabled,
      );
    }
  }, [simplifyFillsDuringCanvasDragEnabled, isClient]);

  useEffect(() => {
    if (isClient) {
      setBooleanDebounced(
        "dw:suppressShadowsOnAllObjectsDuringCanvasDrag:enabled",
        suppressShadowsOnAllObjectsDuringCanvasDragEnabled,
      );
    }
  }, [suppressShadowsOnAllObjectsDuringCanvasDragEnabled, isClient]);

  useEffect(() => {
    if (isClient) {
      setItemDebounced(LEFT_SIDEBAR_MODE_STORAGE_KEY, leftSidebarMode);
    }
  }, [leftSidebarMode, isClient]);
}
