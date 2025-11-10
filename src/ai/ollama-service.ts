/**
 * Ollama Service - Direct API integration with Ollama
 */

interface OllamaGenerateRequest {
  model: string;
  prompt: string;
  stream?: boolean;
  format?: string;
  options?: {
    temperature?: number;
    top_p?: number;
    max_tokens?: number;
  };
}

interface OllamaGenerateResponse {
  model: string;
  created_at: string;
  response: string;
  done: boolean;
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
}

interface OllamaModelsResponse {
  models: Array<{
    name: string;
    size?: number;
    digest?: string;
    modified_at: string;
  }>;
}

export class OllamaService {
  private baseUrl: string;
  private model: string;

  constructor(baseUrl: string = 'http://localhost:11434', model: string = 'deepseek-v3.1:671b-cloud') {
    this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
    this.model = model;
  }

  /**
   * Generate text using Ollama API
   */
  async generate(prompt: string): Promise<string> {
    const request: OllamaGenerateRequest = {
      model: this.model,
      prompt: `You are an expert diagram code generator. You will take a natural language description of a diagram and generate JSON code representing the diagram. The JSON code should include elements and their relationships, following a format suitable for rendering an interactive diagram.

Description: ${prompt}

Ensure the generated JSON is valid and well-structured, so it is readily used by the diagram renderer. Only return the JSON, do not return markdown.`,
      stream: false,
      format: 'json',
      options: {
        temperature: 0.7,
        top_p: 0.9,
        max_tokens: 4000,
      },
    };

    try {
      const response = await fetch(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
      }

      const data: OllamaGenerateResponse = await response.json();
      
      if (data.done && data.response) {
        // Parse the JSON response to ensure it's valid
        try {
          const parsedResponse = JSON.parse(data.response);
          return JSON.stringify(parsedResponse);
        } catch (parseError) {
          // If parsing fails, return the raw response
          console.warn('Failed to parse Ollama JSON response:', parseError);
          return data.response;
        }
      } else {
        throw new Error('Ollama did not return a complete response');
      }
    } catch (error) {
      console.error('Error calling Ollama API:', error);
      throw error;
    }
  }

  /**
   * Check if Ollama service is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        return false;
      }

      const data: OllamaModelsResponse = await response.json();
      const hasModel = data.models.some(model => model.name === this.model);
      
      return hasModel;
    } catch (error) {
      console.error('Error checking Ollama availability:', error);
      return false;
    }
  }

  /**
   * Get available models
   */
  async getModels(): Promise<string[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch models: ${response.status} ${response.statusText}`);
      }

      const data: OllamaModelsResponse = await response.json();
      return data.models.map(model => model.name);
    } catch (error) {
      console.error('Error fetching models:', error);
      return [];
    }
  }

  /**
   * Set the model to use
   */
  setModel(model: string): void {
    this.model = model;
  }

  /**
   * Get current model
   */
  getModel(): string {
    return this.model;
  }
}

// Create and export default instance
export const ollamaService = new OllamaService('http://localhost:11434', 'deepseek-v3.1:671b-cloud');