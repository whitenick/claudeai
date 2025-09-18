import Fastify from 'fastify';
import cors from '@fastify/cors';
import { EventListener } from './services/event-listener.js';
import { RetryService } from './services/retry-service.js';
import { adminNotesRoutes } from './routes/admin-notes.js';
import { healthRoutes } from './routes/health.js';
import { aiAdminRoutes } from './routes/ai-admin.js';
import { failedJobsRoutes } from './routes/failed-jobs.js';

// Create Fastify instance with logging
const fastify = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || 'info',
    transport: process.env.NODE_ENV === 'development' ? {
      target: 'pino-pretty',
      options: {
        translateTime: 'HH:MM:ss Z',
        ignore: 'pid,hostname',
      }
    } : undefined
  }
});

// Create service instances
const eventListener = new EventListener();
const retryService = new RetryService();

// Register CORS
await fastify.register(cors, {
  origin: process.env.NODE_ENV === 'development'
    ? ['http://localhost:3000', 'http://localhost:3001']
    : false
});

// Register routes with event listener context
await fastify.register(adminNotesRoutes, { prefix: '/api' });
await fastify.register(aiAdminRoutes, { prefix: '/api/ai' });
await fastify.register(failedJobsRoutes, { prefix: '/api/failed-jobs' });
await fastify.register(healthRoutes, { eventListener });

// Root endpoint
fastify.get('/', async (request, reply) => {
  return {
    service: 'admin-notes-ai-poc',
    version: '1.0.0',
    description: 'AI-powered admin notes summarization service',
    endpoints: {
      health: '/health',
      detailedHealth: '/health/detailed',
      ready: '/ready',
      live: '/live',
      api: '/api',
      aiAdmin: '/api/ai',
      failedJobs: '/api/failed-jobs'
    },
    documentation: 'https://github.com/your-org/admin-notes-ai-poc'
  };
});

// Start services when server is ready
fastify.addHook('onReady', async () => {
  try {
    await eventListener.startListening();
    fastify.log.info('🎧 Event listener started successfully');

    // Start retry processor for failed jobs
    retryService.startRetryProcessor(30000); // Check every 30 seconds
    fastify.log.info('🔄 Retry processor started successfully');
  } catch (error) {
    fastify.log.error('❌ Failed to start services:', error);
    process.exit(1);
  }
});

// Graceful shutdown
fastify.addHook('onClose', async () => {
  try {
    await eventListener.stopListening();
    fastify.log.info('🛑 Event listener stopped');

    retryService.stopRetryProcessor();
    fastify.log.info('🛑 Retry processor stopped');
  } catch (error) {
    fastify.log.error('❌ Error during shutdown:', error);
  }
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  fastify.log.fatal('Uncaught exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  fastify.log.fatal('Unhandled rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start the server
const start = async (): Promise<void> => {
  try {
    const port = parseInt(process.env.PORT || '3000');
    const host = process.env.HOST || '0.0.0.0';

    await fastify.listen({ port, host });

    fastify.log.info(`🚀 Admin Notes AI POC server running at http://${host}:${port}`);
    fastify.log.info('📝 Ready to process admin notes and generate AI summaries');

  } catch (error) {
    fastify.log.fatal('❌ Error starting server:', error);
    process.exit(1);
  }
};

start();