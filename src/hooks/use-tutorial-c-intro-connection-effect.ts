"use client";

import { useEffect, useRef } from "react";
import type { DiagramData, DiagramConnectionData, DiagramNodeData } from "@/lib/types";
import { generateConnectionId } from "@/lib/connection-order-utils";

/**
 * Tutorial step **c-intro**: ensure A→B exists on the tutorial diagram so the user only adds A→C next.
 * Lives outside `DiagramEditorInner` to keep effect deps isolated (same behavior as inline effect).
 */
export function useTutorialCIntroConnectionEffect(
  tutorialOpen: boolean,
  tutorialStepsLength: number,
  tutorialStepIndex: number,
  tutorialStepId: string | undefined,
  activeDiagramStackLength: number,
  updateTutorialDiagramData: (updater: (prev: DiagramData) => DiagramData) => void,
): void {
  const updateTutorialDiagramDataRef = useRef(updateTutorialDiagramData);
  updateTutorialDiagramDataRef.current = updateTutorialDiagramData;

  useEffect(() => {
    if (!tutorialOpen || !tutorialStepsLength) return;
    if (activeDiagramStackLength > 0) return;
    if (tutorialStepId !== "c-intro") return;

    const FROM = "tutorial-shape-a";
    const TO = "tutorial-shape-b";

    updateTutorialDiagramDataRef.current((prev: DiagramData) => {
      const nodes = prev.nodes || [];
      if (!nodes.some((n: DiagramNodeData) => n.id === FROM) || !nodes.some((n: DiagramNodeData) => n.id === TO))
        return prev;

      const connections = prev.connections || [];
      const alreadyHas = connections.some(
        (c: DiagramConnectionData) =>
          (c.from === FROM && c.to === TO) || (c.from === TO && c.to === FROM),
      );
      if (alreadyHas) return prev;

      const newConn: DiagramConnectionData = {
        id: generateConnectionId(),
        from: FROM,
        to: TO,
        style: "bezier",
        curvature: 0.6,
        animation: {
          enabled: false,
          shape: "dot",
          speed: 20,
          size: 2,
          autoCount: true,
          shapeCount: 5,
          spacing: 2,
        },
        arrow: true,
        toArrow: true,
      };

      return {
        ...prev,
        connections: [...connections, newConn],
      };
    });
  }, [
    tutorialOpen,
    tutorialStepIndex,
    tutorialStepId,
    activeDiagramStackLength,
    tutorialStepsLength,
  ]);
}
