'use server';

/**
 * @fileOverview This file defines a Genkit flow that generates JSON code for a diagram based on a natural language description.
 *
 * - generateDiagramCodeFromDescription - A function that takes a natural language description and returns JSON code for a diagram.
 * - GenerateDiagramCodeFromDescriptionInput - The input type for the generateDiagramCodeFromDescription function.
 * - GenerateDiagramCodeFromDescriptionOutput - The return type for the generateDiagramCodeFromDescription function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateDiagramCodeFromDescriptionInputSchema = z.object({
  description: z
    .string()
    .describe(
      'A natural language description of the diagram to generate, including elements and their relationships.'
    ),
});
export type GenerateDiagramCodeFromDescriptionInput = z.infer<
  typeof GenerateDiagramCodeFromDescriptionInputSchema
>;

const GenerateDiagramCodeFromDescriptionOutputSchema = z.object({
  diagramCode: z
    .string()
    .describe(
      'The JSON code representing the diagram, including elements and their relationships.'
    ),
});
export type GenerateDiagramCodeFromDescriptionOutput = z.infer<
  typeof GenerateDiagramCodeFromDescriptionOutputSchema
>;

export async function generateDiagramCodeFromDescription(
  input: GenerateDiagramCodeFromDescriptionInput
): Promise<GenerateDiagramCodeFromDescriptionOutput> {
  return generateDiagramCodeFromDescriptionFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateDiagramCodeFromDescriptionPrompt',
  input: {schema: GenerateDiagramCodeFromDescriptionInputSchema},
  output: {schema: GenerateDiagramCodeFromDescriptionOutputSchema},
  prompt: `You are an expert diagram code generator.  You will take a
natural language description of a diagram and generate the JSON code
representing the diagram. The JSON code should include elements and their
relationships, following a format suitable for rendering an interactive
diagram.

Description: {{{description}}}

Ensure the generated JSON is valid and well-structured, so it is readily used by the diagram renderer. Only return the JSON, do not return markdown.`, // Removed the handlebars formatting that was escaping characters.
});

const generateDiagramCodeFromDescriptionFlow = ai.defineFlow(
  {
    name: 'generateDiagramCodeFromDescriptionFlow',
    inputSchema: GenerateDiagramCodeFromDescriptionInputSchema,
    outputSchema: GenerateDiagramCodeFromDescriptionOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
