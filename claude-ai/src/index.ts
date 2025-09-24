import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { serve } from '@hono/node-server';
import { EventListener } from './services/event-listener.js';
import { RetryService } from './services/retry-service.js';
import { adminNotesRoutes } from './routes/admin-notes.js';
import { healthRoutes } from './routes/health.js';
import { aiAdminRoutes } from './routes/ai-admin.js';
import { failedJobsRoutes } from './routes/failed-jobs.js';

// Create Hono instance
const app = new Hono();

// Create service instances
const eventListener = new EventListener();
const retryService = new RetryService();

// Register middlewares
app.use('*', logger());
app.use('*', cors({
  origin: process.env.NODE_ENV === 'development'
    ? ['http://localhost:3000', 'http://localhost:3001']
    : [],
  allowHeaders: ['Content-Type', 'Authorization'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
}));

// Register routes
const adminRoutes = adminNotesRoutes(app);
const aiRoutes = aiAdminRoutes(app);
const jobRoutes = failedJobsRoutes(app);
const health = healthRoutes(app, eventListener);

app.route('/api', adminRoutes);
app.route('/api/ai', aiRoutes);
app.route('/api/failed-jobs', jobRoutes);
app.route('/', health);

// Root endpoint
app.get('/', (c) => {
  return c.json({
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
  });
});

// Start services
const startServices = async () => {
  try {
    await eventListener.startListening();
    console.log('🎧 Event listener started successfully');

    // Start retry processor for failed jobs
    retryService.startRetryProcessor(30000); // Check every 30 seconds
    console.log('🔄 Retry processor started successfully');
  } catch (error) {
    console.error('❌ Failed to start services:', error);
    process.exit(1);
  }
};

// Graceful shutdown
const stopServices = async () => {
  try {
    await eventListener.stopListening();
    console.log('🛑 Event listener stopped');

    retryService.stopRetryProcessor();
    console.log('🛑 Retry processor stopped');
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
  }
};

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  await stopServices();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully');
  await stopServices();
  process.exit(0);
});

// Start the server
const start = async (): Promise<void> => {
  try {
    const port = parseInt(process.env.PORT || '3000');
    const host = process.env.HOST || '0.0.0.0';

    // Start services first
    await startServices();

    console.log(`🚀 Admin Notes AI POC server running at http://${host}:${port}`);
    console.log('📝 Ready to process admin notes and generate AI summaries');

    serve({
      fetch: app.fetch,
      port,
      hostname: host
    });

  } catch (error) {
    console.error('❌ Error starting server:', error);
    process.exit(1);
  }
};

start();