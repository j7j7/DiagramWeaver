'use server';

/**
 * Simple AI service for generating diagram JSON from natural language descriptions using Ollama
 */

import { ollamaService } from '@/ai/ollama-service';

export async function generateDiagramCodeFromDescription(
  input: { description: string; currentDiagram?: any }
): Promise<{ diagramCode: string }> {
  try {
    const diagramCode = await ollamaService.generate(input.description, input.currentDiagram);
    return { diagramCode };
  } catch (error) {
    console.error('Error generating diagram:', error);
    throw error;
  }
}
