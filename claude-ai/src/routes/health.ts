import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { db } from '../db/index.js';
import { EventListener } from '../services/event-listener.js';

export async function healthRoutes(
  fastify: FastifyInstance,
  options: FastifyPluginOptions & { eventListener: EventListener }
): Promise<void> {

  // Basic health check
  fastify.get('/health', async (request, reply) => {
    try {
      // Test database connection
      await db.execute`SELECT 1`;

      const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'admin-notes-ai-poc',
        version: '1.0.0',
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development'
      };

      return health;

    } catch (error) {
      fastify.log.error('Health check failed:', error);

      reply.code(503);
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        service: 'admin-notes-ai-poc',
        error: 'Database connection failed'
      };
    }
  });

  // Detailed health check with component status
  fastify.get('/health/detailed', async (request, reply) => {
    const components = {
      database: false,
      eventListener: false,
      ai: false
    };

    let overallStatus = 'healthy';

    // Test database
    try {
      await db.execute`SELECT 1`;
      components.database = true;
    } catch (error) {
      fastify.log.error('Database health check failed:', error);
      overallStatus = 'degraded';
    }

    // Check event listener
    try {
      components.eventListener = options.eventListener.isRunning();
      if (!components.eventListener) {
        overallStatus = 'degraded';
      }
    } catch (error) {
      fastify.log.error('Event listener health check failed:', error);
      overallStatus = 'degraded';
    }

    // Check AI service
    try {
      // Get AI service from event listener context or create a new instance
      const { AIService } = await import('../services/ai-service.js');
      const aiService = new AIService();
      const aiStatus = await aiService.getProviderStatus();

      components.ai = aiStatus.healthy;
      if (!components.ai) {
        overallStatus = 'degraded';
      }
    } catch (error) {
      components.ai = false;
      overallStatus = 'degraded';
    }

    const statusCode = overallStatus === 'healthy' ? 200 : 503;
    reply.code(statusCode);

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      service: 'admin-notes-ai-poc',
      version: '1.0.0',
      uptime: process.uptime(),
      components
    };
  });

  // Readiness probe (for Kubernetes)
  fastify.get('/ready', async (request, reply) => {
    try {
      // Test critical dependencies
      await db.execute`SELECT 1`;

      if (!options.eventListener.isRunning()) {
        throw new Error('Event listener not running');
      }

      // Check if AI provider is configured
      const aiProvider = process.env.AI_PROVIDER || 'claude';
      const apiKeyMap = {
        'claude': process.env.CLAUDE_API_KEY,
        'openai': process.env.OPENAI_API_KEY
      };

      if (!apiKeyMap[aiProvider]) {
        throw new Error(`${aiProvider} API key not configured`);
      }

      return { status: 'ready' };

    } catch (error) {
      fastify.log.error('Readiness check failed:', error);

      reply.code(503);
      return {
        status: 'not ready',
        reason: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  // Liveness probe (for Kubernetes)
  fastify.get('/live', async (request, reply) => {
    return {
      status: 'alive',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    };
  });
}