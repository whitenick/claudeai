import { AiProvider, AiProviderType, AiProviderConfig } from '../../types/ai-provider.js';
import { ClaudeProvider } from './claude-provider.js';
import { OpenAiProvider } from './openai-provider.js';

export class AiProviderFactory {
  private static providers: Map<AiProviderType, () => AiProvider> = new Map([
    ['claude', () => new ClaudeProvider()],
    ['openai', () => new OpenAiProvider()],
    // Add more providers here as needed
    // ['azure-openai', () => new AzureOpenAiProvider()],
    // ['palm', () => new PalmProvider()],
    // ['cohere', () => new CohereProvider()],
  ]);

  static async createProvider(
    type: AiProviderType,
    config: AiProviderConfig
  ): Promise<AiProvider> {
    const providerFactory = this.providers.get(type);

    if (!providerFactory) {
      throw new Error(`Unsupported AI provider type: ${type}`);
    }

    const provider = providerFactory();
    await provider.initialize(config);

    return provider;
  }

  static getSupportedProviders(): AiProviderType[] {
    return Array.from(this.providers.keys());
  }

  static getProviderCapabilities(type: AiProviderType): string[] {
    const providerFactory = this.providers.get(type);
    if (!providerFactory) {
      return [];
    }

    const provider = providerFactory();
    return provider.getProviderInfo().capabilities;
  }

  /**
   * Register a custom provider
   */
  static registerProvider(
    type: AiProviderType,
    factory: () => AiProvider
  ): void {
    this.providers.set(type, factory);
  }

  /**
   * Get default model for a provider type
   */
  static getDefaultModel(type: AiProviderType): string {
    const defaults: Record<AiProviderType, string> = {
      'claude': 'claude-3-5-sonnet-20241022',
      'openai': 'gpt-4-turbo',
      'azure-openai': 'gpt-4',
      'palm': 'text-bison-001',
      'cohere': 'command'
    };

    return defaults[type] || '';
  }

  /**
   * Get recommended settings for different use cases
   */
static getRecommendedSettings(
    useCase: 'summarization' | 'analysis' | 'conversation' | 'creative'
  ) {
    const settings = {
      summarization: {
        temperature: 0.1,
        maxTokens: 1500
      },
      analysis: {
        temperature: 0.2,
        maxTokens: 2000
      },
      conversation: {
        temperature: 0.7,
        maxTokens: 1000
      },
      creative: {
        temperature: 0.9,
        maxTokens: 2000
      }
    };

    return settings[useCase];
  }
}