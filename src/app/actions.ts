"use server";

import { generateDiagramCodeFromDescription } from "@/ai/flows/generate-diagram-code-from-description";
import { substituteServices, detectProvider } from "@/ai/service-substitution";
import type { DiagramData } from "@/lib/types";

export async function generateDiagram(
  description: string,
  currentDiagram?: DiagramData
): Promise<{ data: DiagramData | null; error: string | null }> {
  if (!description?.trim()) {
    return { data: null, error: "Please provide a description for the diagram." };
  }

  try {
    const result = await generateDiagramCodeFromDescription({ description, currentDiagram });
    
    // Log the raw AI response for debugging
    console.log("AI Raw Response:", result.diagramCode);
    
    // The AI returns a JSON string, which needs to be parsed.
    const diagramCode = JSON.parse(result.diagramCode);
    
    // Log the parsed diagram structure
    console.log("Parsed Diagram Structure:", JSON.stringify(diagramCode, null, 2));

    // Merge with current diagram if available to preserve existing state
    // This handles cases where the AI returns only new/modified items or a complete set
    if (currentDiagram) {
      // Merge nodes: Update existing ones, add new ones
      const mergedNodesMap = new Map(currentDiagram.nodes.map(n => [n.id, n]));
      diagramCode.nodes.forEach((node: any) => {
        mergedNodesMap.set(node.id, node);
      });
      diagramCode.nodes = Array.from(mergedNodesMap.values());

      // Merge connections: Update existing ones, add new ones
      // Key connections by from-to pair to avoid duplicates
      const mergedConnectionsMap = new Map();
      
      // Add existing connections
      currentDiagram.connections.forEach((conn: any) => {
        const key = `${conn.from}-${conn.to}`;
        mergedConnectionsMap.set(key, conn);
      });
      
      // Merge new/updated connections
      diagramCode.connections.forEach((conn: any) => {
        const key = `${conn.from}-${conn.to}`;
        mergedConnectionsMap.set(key, conn);
      });
      
      diagramCode.connections = Array.from(mergedConnectionsMap.values());
      
      // Merge zones if present (less common for AI to manipulate zones yet, but good practice)
      if (currentDiagram.zones) {
         if (!diagramCode.zones) diagramCode.zones = [];
         const mergedZonesMap = new Map(currentDiagram.zones.map((z: any) => [z.id, z]));
         diagramCode.zones.forEach((zone: any) => {
             mergedZonesMap.set(zone.id, zone);
         });
         diagramCode.zones = Array.from(mergedZonesMap.values());
      }
      
      // Preserve groupings
      if (currentDiagram.groupings) {
          if (!diagramCode.groupings) diagramCode.groupings = [];
          // Simple merge for groupings
          const mergedGroupingsMap = new Map(currentDiagram.groupings.map((g: any) => [g.id, g]));
          diagramCode.groupings.forEach((g: any) => {
              mergedGroupingsMap.set(g.id, g);
          });
          diagramCode.groupings = Array.from(mergedGroupingsMap.values());
      }
    }

    // Basic validation to ensure parsed object has nodes and connections arrays.
    if (!diagramCode.nodes || !diagramCode.connections || !Array.isArray(diagramCode.nodes) || !Array.isArray(diagramCode.connections)) {
        console.error("Invalid structure - missing nodes or connections arrays");
        console.error("Available keys:", Object.keys(diagramCode));
        throw new Error(`Invalid diagram structure returned by AI. Expected 'nodes' and 'connections' arrays, got: ${Object.keys(diagramCode).join(', ')}`);
    }

    // Filter out invalid connections
    const validNodeIds = new Set(diagramCode.nodes.map((n: any) => n.id));
    const initialConnectionCount = diagramCode.connections.length;
    
    diagramCode.connections = diagramCode.connections.filter((conn: any) => {
      const fromValid = validNodeIds.has(conn.from);
      const toValid = validNodeIds.has(conn.to);
      if (!fromValid || !toValid) {
        console.warn(`Filtering invalid connection: ${conn.from} -> ${conn.to} (Node missing)`);
      }
      return fromValid && toValid;
    });

    if (diagramCode.connections.length < initialConnectionCount) {
      console.log(`Filtered ${initialConnectionCount - diagramCode.connections.length} invalid connections`);
    }

    // Ensure optional arrays exist
    if (!diagramCode.zones) {
      diagramCode.zones = [];
    }
    if (!diagramCode.groupings) {
      diagramCode.groupings = [];
    }

    // Apply service substitution to convert generic terms to specific services
    const detectedProvider = detectProvider(diagramCode.nodes);
    console.log("Detected provider:", detectedProvider);
    
    // Only apply substitution if a specific provider is detected
    const finalProvider = detectedProvider === 'generic' ? 'aws' : detectedProvider;
    const substitutedDiagram = substituteServices(diagramCode, finalProvider);
    console.log("After substitution:", JSON.stringify(substitutedDiagram, null, 2));

    return { data: substitutedDiagram, error: null };
  } catch (e) {
    console.error("Failed to generate or parse diagram:", e);
    const errorMessage = e instanceof Error ? e.message : "An unknown error occurred.";
    return {
      data: null,
      error: `Failed to generate diagram. The AI may have returned an invalid format. Details: ${errorMessage}`,
    };
  }
}