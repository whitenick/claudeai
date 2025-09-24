import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { db } from '../db/index.js';
import { EventListener } from '../services/event-listener.js';

export function healthRoutes(app: Hono, eventListener: EventListener) {
  const routes = new Hono();

  // Basic health check
  routes.get('/health', async (c) => {
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

      return c.json(health);

    } catch (error) {
      console.error('Health check failed:', error);

      throw new HTTPException(503, {
        message: 'Database connection failed',
        res: new Response(JSON.stringify({
          status: 'unhealthy',
          timestamp: new Date().toISOString(),
          service: 'admin-notes-ai-poc',
          error: 'Database connection failed'
        }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        })
      });
    }
  });

  // Detailed health check with component status
  routes.get('/health/detailed', async (c) => {
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
      console.error('Database health check failed:', error);
      overallStatus = 'degraded';
    }

    // Check event listener
    try {
      components.eventListener = eventListener.isRunning();
      if (!components.eventListener) {
        overallStatus = 'degraded';
      }
    } catch (error) {
      console.error('Event listener health check failed:', error);
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

    const response = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      service: 'admin-notes-ai-poc',
      version: '1.0.0',
      uptime: process.uptime(),
      components
    };

    return c.json(response, overallStatus === 'healthy' ? 200 : 503);
  });

  // Readiness probe (for Kubernetes)
  routes.get('/ready', async (c) => {
    try {
      // Test critical dependencies
      await db.execute`SELECT 1`;

      if (!eventListener.isRunning()) {
        throw new Error('Event listener not running');
      }

      // Check if AI provider is configured
      const aiProvider = process.env.AI_PROVIDER || 'claude';
      const apiKeyMap = {
        'claude': process.env.CLAUDE_API_KEY,
        'openai': process.env.OPENAI_API_KEY
      };

      if (!apiKeyMap[aiProvider as keyof typeof apiKeyMap]) {
        throw new Error(`${aiProvider} API key not configured`);
      }

      return c.json({ status: 'ready' });

    } catch (error) {
      console.error('Readiness check failed:', error);

      throw new HTTPException(503, {
        message: 'Service not ready',
        res: new Response(JSON.stringify({
          status: 'not ready',
          reason: error instanceof Error ? error.message : 'Unknown error'
        }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        })
      });
    }
  });

  // Liveness probe (for Kubernetes)
  routes.get('/live', async (c) => {
    return c.json({
      status: 'alive',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    });
  });

  return routes;
}