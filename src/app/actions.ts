"use server";

import { generateDiagramCodeFromDescription } from "@/ai/flows/generate-diagram-code-from-description";
import type { DiagramData } from "@/lib/types";

export async function generateDiagram(
  description: string
): Promise<{ data: DiagramData | null; error: string | null }> {
  if (!description?.trim()) {
    return { data: null, error: "Please provide a description for the diagram." };
  }

  try {
    const result = await generateDiagramCodeFromDescription({ description });
    
    // Log the raw AI response for debugging
    console.log("AI Raw Response:", result.diagramCode);
    
    // The AI returns a JSON string, which needs to be parsed.
    const diagramCode = JSON.parse(result.diagramCode);
    
    // Log the parsed diagram structure
    console.log("Parsed Diagram Structure:", JSON.stringify(diagramCode, null, 2));

    // Basic validation to ensure parsed object has nodes and connections arrays.
    if (!diagramCode.nodes || !diagramCode.connections || !Array.isArray(diagramCode.nodes) || !Array.isArray(diagramCode.connections)) {
        console.error("Invalid structure - missing nodes or connections arrays");
        console.error("Available keys:", Object.keys(diagramCode));
        throw new Error(`Invalid diagram structure returned by AI. Expected 'nodes' and 'connections' arrays, got: ${Object.keys(diagramCode).join(', ')}`);
    }

    return { data: diagramCode, error: null };
  } catch (e) {
    console.error("Failed to generate or parse diagram:", e);
    const errorMessage = e instanceof Error ? e.message : "An unknown error occurred.";
    return {
      data: null,
      error: `Failed to generate diagram. The AI may have returned an invalid format. Details: ${errorMessage}`,
    };
  }
}