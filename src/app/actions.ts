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
    // The AI returns a JSON string, which needs to be parsed.
    const diagramCode = JSON.parse(result.diagramCode);

    // Basic validation to ensure the parsed object has nodes and edges arrays.
    if (!diagramCode.nodes || !diagramCode.edges || !Array.isArray(diagramCode.nodes) || !Array.isArray(diagramCode.edges)) {
        throw new Error("Invalid diagram structure returned by AI.");
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
