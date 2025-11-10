"use server";

import { generateDiagramCodeFromDescription } from "@/ai/flows/generate-diagram-code-from-description";
import { substituteServices, detectProvider } from "@/ai/service-substitution";
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