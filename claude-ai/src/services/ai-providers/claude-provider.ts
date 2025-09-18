import Anthropic from '@anthropic-ai/sdk';
import { BaseAiProvider } from './base-provider.js';
import { AiRequest, AiResponse, AiProviderConfig } from '../../types/ai-provider.js';

export class ClaudeProvider extends BaseAiProvider {
  readonly name = 'claude';
  readonly supportedModels = [
    'claude-3-5-sonnet-20241022',
    'claude-3-opus-20240229',
    'claude-3-sonnet-20240229',
    'claude-3-haiku-20240307'
  ];

  private client?: Anthropic;

  async initialize(config: AiProviderConfig): Promise<void> {
    await super.initialize(config);

    this.client = new Anthropic({
      apiKey: config.apiKey,
      baseURL: config.baseUrl,
      timeout: config.timeout || 30000,
      maxRetries: config.maxRetries || 3
    });
  }

  async generateCompletion(request: AiRequest): Promise<AiResponse> {
    this.ensureInitialized();

    if (!this.client) {
      throw this.createError('CLIENT_NOT_INITIALIZED', 'Claude client not initialized', false);
    }

    this.validateRequest(request);

    try {
      const messages = request.messages.filter(msg => msg.role !== 'system');
      const systemMessage = request.systemPrompt ||
        request.messages.find(msg => msg.role === 'system')?.content;

      const response = await this.client.messages.create({
        model: request.model,
        max_tokens: request.maxTokens,
        temperature: request.temperature,
        system: systemMessage,
        messages: messages.map(msg => ({
          role: msg.role as 'user' | 'assistant',
          content: msg.content
        }))
      });

      return {
        content: response.content[0]?.text || '',
        usage: {
          promptTokens: response.usage.input_tokens,
          completionTokens: response.usage.output_tokens,
          totalTokens: response.usage.input_tokens + response.usage.output_tokens
        },
        model: response.model,
        finishReason: response.stop_reason || 'stop'
      };

    } catch (error) {
      throw this.handleError(error);
    }
  }

  async healthCheck(): Promise<boolean> {
    if (!this.initialized || !this.client) {
      return false;
    }

    try {
      const response = await this.client.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: 10,
        messages: [{ role: 'user', content: 'Health check' }]
      });

      return response.content.length > 0;
    } catch (error) {
      console.error('Claude health check failed:', error);
      return false;
    }
  }

  getProviderInfo() {
    return {
      name: 'Anthropic Claude',
      version: '2024.1',
      capabilities: [
        'text-generation',
        'conversation',
        'analysis',
        'reasoning',
        'summarization',
        'code-generation'
      ]
    };
  }

  private validateRequest(request: AiRequest): void {
    if (!this.supportedModels.includes(request.model)) {
      throw this.createError(
        'UNSUPPORTED_MODEL',
        `Model ${request.model} is not supported by Claude provider`,
        false
      );
    }

    if (request.maxTokens > 8192) {
      throw this.createError(
        'INVALID_REQUEST',
        'Claude max tokens cannot exceed 8192',
        false
      );
    }

    if (request.temperature < 0 || request.temperature > 1) {
      throw this.createError(
        'INVALID_REQUEST',
        'Temperature must be between 0 and 1',
        false
      );
    }
  }

  private handleError(error: any) {
    if (error instanceof Anthropic.APIError) {
      const retryable = this.mapHttpStatusToRetryable(error.status || 500);

      return this.createError(
        'CLAUDE_API_ERROR',
        `Claude API error: ${error.message}`,
        retryable,
        error.status
      );
    }

    if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
      return this.createError(
        'NETWORK_ERROR',
        'Network error connecting to Claude API',
        true
      );
    }

    return this.createError(
      'UNKNOWN_ERROR',
      `Unexpected error: ${error.message}`,
      false
    );
  }
}