/**
 * Ollama Configuration
 * Centralized configuration for Ollama connection settings
 */

export interface OllamaConfig {
  baseUrl: string;
  model: string;
  temperature: number;
  topP: number;
  maxTokens: number;
}

// Default configuration
export const defaultOllamaConfig: OllamaConfig = {
  baseUrl: process.env.OLLAMA_BASE_URL || 'http://ub:11434',
  model: process.env.OLLAMA_MODEL || 'llama3.2:latest',
  temperature: 0.7,
  topP: 0.9,
  maxTokens: 4000,
};

// Get current configuration (can be modified at runtime)
let currentConfig: OllamaConfig = { ...defaultOllamaConfig };

export const ollamaConfig = {
  /**
   * Get current configuration
   */
  get(): OllamaConfig {
    return { ...currentConfig };
  },

  /**
   * Update configuration
   */
  update(config: Partial<OllamaConfig>): void {
    currentConfig = { ...currentConfig, ...config };
  },

  /**
   * Reset to default configuration
   */
  reset(): void {
    currentConfig = { ...defaultOllamaConfig };
  },

  /**
   * Get base URL
   */
  getBaseUrl(): string {
    return currentConfig.baseUrl.replace(/\/$/, ''); // Remove trailing slash
  },

  /**
   * Get model name
   */
  getModel(): string {
    return currentConfig.model;
  },

  /**
   * Set model
   */
  setModel(model: string): void {
    currentConfig.model = model;
  },

  /**
   * Set base URL
   */
  setBaseUrl(baseUrl: string): void {
    currentConfig.baseUrl = baseUrl.replace(/\/$/, '');
  },
};