"use client";

import { useEffect, type Dispatch, type SetStateAction } from "react";
import { getItemSafe, setBooleanDebounced, setItemDebounced } from "@/lib/local-storage-debounce";

export interface UseDiagramEditorOptionPersistenceParams {
  isClient: boolean;
  jsonPanelWidth: number;
  iconBackgroundEnabled: boolean;
  defaultTextLabelsEnabled: boolean;
  alignmentGuidesEnabled: boolean;
  connectionsBehindNodesEnabled: boolean;
  animationConnectionsUserEnabled: boolean;
  animationToggleOnClickEnabled: boolean;
  setRightPanelCollapsed: Dispatch<SetStateAction<boolean>>;
  setPropertiesPanelVisible: Dispatch<SetStateAction<boolean>>;
  setMetadataPopupsEnabled: Dispatch<SetStateAction<boolean>>;
  setAlignmentGuidesEnabled: Dispatch<SetStateAction<boolean>>;
  setConnectionsBehindNodesEnabled: Dispatch<SetStateAction<boolean>>;
  setAnimationConnectionsUserEnabled: Dispatch<SetStateAction<boolean>>;
  setAnimationToggleOnClickEnabled: Dispatch<SetStateAction<boolean>>;
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
    connectionsBehindNodesEnabled,
    animationConnectionsUserEnabled,
    animationToggleOnClickEnabled,
    setRightPanelCollapsed,
    setPropertiesPanelVisible,
    setMetadataPopupsEnabled,
    setAlignmentGuidesEnabled,
    setConnectionsBehindNodesEnabled,
    setAnimationConnectionsUserEnabled,
    setAnimationToggleOnClickEnabled,
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
    if (typeof window === "undefined") return;
    const savedCollapsed = getItemSafe("dw:propertiesPanel:collapsed");
    if (savedCollapsed !== null) setRightPanelCollapsed(savedCollapsed === "true");
    const savedVisible = getItemSafe("dw:propertiesPanel:visible");
    if (savedVisible !== null) setPropertiesPanelVisible(savedVisible !== "false");
    const savedPopups = getItemSafe("dw:metadataPopups:enabled");
    if (savedPopups !== null) setMetadataPopupsEnabled(savedPopups !== "false");
    const savedGuides = getItemSafe("dw:alignmentGuides:enabled");
    if (savedGuides !== null) setAlignmentGuidesEnabled(savedGuides !== "false");
    const savedConnectionsBehind = getItemSafe("dw:connectionsBehindNodes:enabled");
    if (savedConnectionsBehind !== null) setConnectionsBehindNodesEnabled(savedConnectionsBehind !== "false");
    const savedAnimationConnections = getItemSafe("dw:animationConnections:enabled");
    if (savedAnimationConnections !== null) setAnimationConnectionsUserEnabled(savedAnimationConnections !== "false");
    const savedAnimationToggleOnClick = getItemSafe("dw:animationToggleOnClick:enabled");
    if (savedAnimationToggleOnClick !== null) setAnimationToggleOnClickEnabled(savedAnimationToggleOnClick === "true");
  }, [
    setRightPanelCollapsed,
    setPropertiesPanelVisible,
    setMetadataPopupsEnabled,
    setAlignmentGuidesEnabled,
    setConnectionsBehindNodesEnabled,
    setAnimationConnectionsUserEnabled,
    setAnimationToggleOnClickEnabled,
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
}
