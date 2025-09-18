import { BaseAiProvider } from './base-provider.js';
import { AiRequest, AiResponse, AiProviderConfig } from '../../types/ai-provider.js';

interface OpenAiMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OpenAiRequest {
  model: string;
  messages: OpenAiMessage[];
  max_tokens: number;
  temperature: number;
}

interface OpenAiResponse {
  choices: Array<{
    message: {
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  model: string;
}

export class OpenAiProvider extends BaseAiProvider {
  readonly name = 'openai';
  readonly supportedModels = [
    'gpt-4',
    'gpt-4-turbo',
    'gpt-4-turbo-preview',
    'gpt-3.5-turbo',
    'gpt-3.5-turbo-16k'
  ];

  private baseUrl: string;
  private headers: Record<string, string>;

  async initialize(config: AiProviderConfig): Promise<void> {
    await super.initialize(config);

    this.baseUrl = config.baseUrl || 'https://api.openai.com/v1';
    this.headers = {
      'Authorization': `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
      'User-Agent': 'admin-notes-ai-poc/1.0.0'
    };
  }

  async generateCompletion(request: AiRequest): Promise<AiResponse> {
    this.ensureInitialized();
    this.validateRequest(request);

    try {
      const openAiRequest: OpenAiRequest = {
        model: request.model,
        messages: this.buildMessages(request),
        max_tokens: request.maxTokens,
        temperature: request.temperature
      };

      const response = await this.makeRequest('/chat/completions', openAiRequest);

      return {
        content: response.choices[0]?.message?.content || '',
        usage: {
          promptTokens: response.usage.prompt_tokens,
          completionTokens: response.usage.completion_tokens,
          totalTokens: response.usage.total_tokens
        },
        model: response.model,
        finishReason: response.choices[0]?.finish_reason || 'stop'
      };

    } catch (error) {
      throw this.handleError(error);
    }
  }

  async healthCheck(): Promise<boolean> {
    if (!this.initialized) {
      return false;
    }

    try {
      const response = await this.makeRequest('/chat/completions', {
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: 'Health check' }],
        max_tokens: 5,
        temperature: 0
      });

      return response.choices && response.choices.length > 0;
    } catch (error) {
      console.error('OpenAI health check failed:', error);
      return false;
    }
  }

  getProviderInfo() {
    return {
      name: 'OpenAI GPT',
      version: '2024.1',
      capabilities: [
        'text-generation',
        'conversation',
        'analysis',
        'reasoning',
        'summarization',
        'code-generation',
        'function-calling'
      ]
    };
  }

  private buildMessages(request: AiRequest): OpenAiMessage[] {
    const messages: OpenAiMessage[] = [];

    // Add system message if present
    const systemContent = request.systemPrompt ||
      request.messages.find(msg => msg.role === 'system')?.content;

    if (systemContent) {
      messages.push({ role: 'system', content: systemContent });
    }

    // Add other messages (excluding system messages since we handled it above)
    const nonSystemMessages = request.messages.filter(msg => msg.role !== 'system');
    messages.push(...nonSystemMessages);

    return messages;
  }

  private async makeRequest(endpoint: string, data: any): Promise<OpenAiResponse> {
    const url = `${this.baseUrl}${endpoint}`;
    const timeout = this.config?.timeout || 30000;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify(data),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorBody}`);
      }

      return await response.json();
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  private validateRequest(request: AiRequest): void {
    if (!this.supportedModels.includes(request.model)) {
      throw this.createError(
        'UNSUPPORTED_MODEL',
        `Model ${request.model} is not supported by OpenAI provider`,
        false
      );
    }

    if (request.maxTokens > 16384) {
      throw this.createError(
        'INVALID_REQUEST',
        'OpenAI max tokens cannot exceed 16384',
        false
      );
    }

    if (request.temperature < 0 || request.temperature > 2) {
      throw this.createError(
        'INVALID_REQUEST',
        'Temperature must be between 0 and 2',
        false
      );
    }

    if (request.messages.length === 0) {
      throw this.createError(
        'INVALID_REQUEST',
        'At least one message is required',
        false
      );
    }
  }

  private handleError(error: any) {
    if (error.name === 'AbortError') {
      return this.createError(
        'TIMEOUT_ERROR',
        'Request timed out',
        true
      );
    }

    if (error.message.includes('HTTP 4')) {
      const statusCode = parseInt(error.message.match(/HTTP (\d+)/)?.[1] || '400');
      const retryable = this.mapHttpStatusToRetryable(statusCode);

      return this.createError(
        'OPENAI_API_ERROR',
        `OpenAI API error: ${error.message}`,
        retryable,
        statusCode
      );
    }

    if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
      return this.createError(
        'NETWORK_ERROR',
        'Network error connecting to OpenAI API',
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