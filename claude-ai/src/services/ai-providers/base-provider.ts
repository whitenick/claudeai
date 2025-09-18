import { AiProvider, AiProviderConfig, AiProviderError } from '../../types/ai-provider.js';

export abstract class BaseAiProvider implements AiProvider {
  protected config?: AiProviderConfig;
  protected initialized = false;

  abstract readonly name: string;
  abstract readonly supportedModels: string[];

  async initialize(config: AiProviderConfig): Promise<void> {
    this.validateConfig(config);
    this.config = config;
    this.initialized = true;
  }

  protected ensureInitialized(): void {
    if (!this.initialized || !this.config) {
      throw this.createError(
        'PROVIDER_NOT_INITIALIZED',
        'AI provider not initialized. Call initialize() first.',
        false
      );
    }
  }

  protected validateConfig(config: AiProviderConfig): void {
    if (!config.apiKey || config.apiKey.trim().length === 0) {
      throw this.createError(
        'INVALID_CONFIG',
        'API key is required',
        false
      );
    }
  }

  protected createError(
    code: string,
    message: string,
    retryable: boolean,
    statusCode?: number
  ): AiProviderError {
    const error = new Error(message) as AiProviderError;
    error.code = code;
    error.retryable = retryable;
    error.statusCode = statusCode;
    return error;
  }

  protected mapHttpStatusToRetryable(statusCode: number): boolean {
    // Retry on server errors and rate limits
    return statusCode >= 500 || statusCode === 429 || statusCode === 408;
  }

  abstract generateCompletion(request: any): Promise<any>;
  abstract healthCheck(): Promise<boolean>;
  abstract getProviderInfo(): { name: string; version: string; capabilities: string[] };
}