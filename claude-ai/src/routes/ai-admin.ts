import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { AIService } from '../services/ai-service.js';
import { AiProviderFactory } from '../services/ai-providers/provider-factory.js';
import { z } from 'zod';

const switchProviderSchema = z.object({
  provider: z.enum(['claude', 'openai']),
  apiKey: z.string().min(1),
  model: z.string().optional()
});

export function aiAdminRoutes(app: Hono) {
  const routes = new Hono();

  // Get current AI provider status
  routes.get('/provider/status', async (c) => {
    try {
      const aiService = new AIService();
      const status = await aiService.getProviderStatus();

      return c.json({
        success: true,
        status
      });
    } catch (error) {
      console.error('Failed to get AI provider status:', error);

      throw new HTTPException(500, {
        message: 'Failed to get AI provider status'
      });
    }
  });

  // Get available AI providers and their capabilities
  routes.get('/providers', async (c) => {
    try {
      const supportedProviders = AiProviderFactory.getSupportedProviders();

      const providers = supportedProviders.map(provider => ({
        type: provider,
        defaultModel: AiProviderFactory.getDefaultModel(provider),
        capabilities: AiProviderFactory.getProviderCapabilities(provider)
      }));

      return c.json({
        success: true,
        providers,
        current: process.env.AI_PROVIDER || 'claude'
      });
    } catch (error) {
      console.error('Failed to get available providers:', error);

      throw new HTTPException(500, {
        message: 'Failed to get available providers'
      });
    }
  });

  // Switch AI provider (for testing/admin purposes)
  routes.post('/provider/switch', async (c) => {
    try {
      const body = await c.req.json();
      const data = switchProviderSchema.parse(body);

      const aiService = new AIService();
      await aiService.switchProvider(data.provider, data.apiKey, data.model);

      // Update environment for future instances (note: this only affects current process)
      process.env.AI_PROVIDER = data.provider;
      if (data.model) {
        process.env.AI_MODEL = data.model;
      }

      const newStatus = await aiService.getProviderStatus();

      return c.json({
        success: true,
        message: `Successfully switched to ${data.provider} provider`,
        status: newStatus
      });

    } catch (error) {
      console.error('Failed to switch AI provider:', error);

      if (error instanceof Error && error.name === 'ZodError') {
        throw new HTTPException(400, {
          message: 'Invalid request data'
        });
      }

      throw new HTTPException(500, {
        message: `Failed to switch provider: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
  });

  // Get recommended settings for different use cases
  routes.get('/settings/:useCase', async (c) => {
    try {
      const useCase = c.req.param('useCase');

      if (!['summarization', 'analysis', 'conversation', 'creative'].includes(useCase)) {
        throw new HTTPException(400, {
          message: 'Invalid use case. Supported: summarization, analysis, conversation, creative'
        });
      }

      const settings = AiProviderFactory.getRecommendedSettings(useCase as any);

      return c.json({
        success: true,
        useCase,
        settings
      });
    } catch (error) {
      console.error('Failed to get recommended settings:', error);

      if (error instanceof HTTPException) {
        throw error;
      }

      throw new HTTPException(500, {
        message: 'Failed to get recommended settings'
      });
    }
  });

  return routes;
}