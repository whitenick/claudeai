export interface AiMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AiRequest {
  model: string;
  messages: AiMessage[];
  maxTokens: number;
  temperature: number;
  systemPrompt?: string;
}

export interface AiResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model: string;
  finishReason?: string;
}

export interface AiProviderConfig {
  apiKey: string;
  baseUrl?: string;
  timeout?: number;
  maxRetries?: number;
}

export interface AiProvider {
  readonly name: string;
  readonly supportedModels: string[];

  /**
   * Initialize the provider with configuration
   */
  initialize(config: AiProviderConfig): Promise<void>;

  /**
   * Generate a completion using the AI provider
   */
  generateCompletion(request: AiRequest): Promise<AiResponse>;

  /**
   * Test connectivity to the AI provider
   */
  healthCheck(): Promise<boolean>;

  /**
   * Get provider-specific information
   */
  getProviderInfo(): {
    name: string;
    version: string;
    capabilities: string[];
  };
}

export interface AiProviderError extends Error {
  code: string;
  statusCode?: number;
  retryable: boolean;
}

export type AiProviderType = 'claude' | 'openai' | 'azure-openai' | 'palm' | 'cohere';