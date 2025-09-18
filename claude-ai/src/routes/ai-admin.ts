import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { AIService } from '../services/ai-service.js';
import { AiProviderFactory } from '../services/ai-providers/provider-factory.js';
import { z } from 'zod';

const switchProviderSchema = z.object({
  provider: z.enum(['claude', 'openai']),
  apiKey: z.string().min(1),
  model: z.string().optional()
});

export async function aiAdminRoutes(
  fastify: FastifyInstance,
  options: FastifyPluginOptions
): Promise<void> {

  // Get current AI provider status
  fastify.get('/provider/status', async (request, reply) => {
    try {
      const aiService = new AIService();
      const status = await aiService.getProviderStatus();

      return {
        success: true,
        status
      };
    } catch (error) {
      fastify.log.error('Failed to get AI provider status:', error);

      reply.code(500);
      return {
        success: false,
        error: 'Failed to get AI provider status'
      };
    }
  });

  // Get available AI providers and their capabilities
  fastify.get('/providers', async (request, reply) => {
    try {
      const supportedProviders = AiProviderFactory.getSupportedProviders();

      const providers = supportedProviders.map(provider => ({
        type: provider,
        defaultModel: AiProviderFactory.getDefaultModel(provider),
        capabilities: AiProviderFactory.getProviderCapabilities(provider)
      }));

      return {
        success: true,
        providers,
        current: process.env.AI_PROVIDER || 'claude'
      };
    } catch (error) {
      fastify.log.error('Failed to get available providers:', error);

      reply.code(500);
      return {
        success: false,
        error: 'Failed to get available providers'
      };
    }
  });

  // Switch AI provider (for testing/admin purposes)
  fastify.post('/provider/switch', async (request, reply) => {
    try {
      const data = switchProviderSchema.parse(request.body);

      const aiService = new AIService();
      await aiService.switchProvider(data.provider, data.apiKey, data.model);

      // Update environment for future instances (note: this only affects current process)
      process.env.AI_PROVIDER = data.provider;
      if (data.model) {
        process.env.AI_MODEL = data.model;
      }

      const newStatus = await aiService.getProviderStatus();

      return {
        success: true,
        message: `Successfully switched to ${data.provider} provider`,
        status: newStatus
      };

    } catch (error) {
      fastify.log.error('Failed to switch AI provider:', error);

      if (error instanceof Error && error.name === 'ZodError') {
        reply.code(400);
        return {
          success: false,
          error: 'Invalid request data',
          details: error.message
        };
      }

      reply.code(500);
      return {
        success: false,
        error: `Failed to switch provider: ${error.message}`
      };
    }
  });

  // Get recommended settings for different use cases
  fastify.get('/settings/:useCase', async (request, reply) => {
    try {
      const { useCase } = request.params as { useCase: string };

      if (!['summarization', 'analysis', 'conversation', 'creative'].includes(useCase)) {
        reply.code(400);
        return {
          success: false,
          error: 'Invalid use case. Supported: summarization, analysis, conversation, creative'
        };
      }

      const settings = AiProviderFactory.getRecommendedSettings(useCase as any);

      return {
        success: true,
        useCase,
        settings
      };
    } catch (error) {
      fastify.log.error('Failed to get recommended settings:', error);

      reply.code(500);
      return {
        success: false,
        error: 'Failed to get recommended settings'
      };
    }
  });
}