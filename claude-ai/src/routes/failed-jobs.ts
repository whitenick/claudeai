import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { RetryService } from '../services/retry-service.js';
import { z } from 'zod';

const retryJobSchema = z.object({
  jobId: z.string().uuid()
});

const cleanupJobsSchema = z.object({
  daysOld: z.number().min(1).max(365).default(30)
});

export function failedJobsRoutes(app: Hono) {
  const routes = new Hono();
  const retryService = new RetryService();

  // Get failed jobs statistics
  routes.get('/stats', async (c) => {
    try {
      const stats = await retryService.getFailedJobsStats();

      return c.json({
        success: true,
        stats
      });
    } catch (error) {
      console.error('Failed to get failed jobs stats:', error);

      throw new HTTPException(500, {
        message: 'Failed to get failed jobs statistics'
      });
    }
  });

  // Manually retry a specific job
  routes.post('/retry/:jobId', async (c) => {
    try {
      const jobId = c.req.param('jobId');

      // Validate jobId is UUID
      retryJobSchema.parse({ jobId });

      await retryService.retryJobById(jobId);

      return c.json({
        success: true,
        message: `Job ${jobId} queued for retry`
      });

    } catch (error) {
      console.error('Failed to retry job:', error);

      if (error instanceof Error && error.name === 'ZodError') {
        throw new HTTPException(400, {
          message: 'Invalid job ID format'
        });
      }

      throw new HTTPException(500, {
        message: `Failed to retry job: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
  });

  // Cleanup old abandoned jobs
  routes.delete('/cleanup', async (c) => {
    try {
      const query = c.req.query();
      const { daysOld } = cleanupJobsSchema.parse(query);
      const deletedCount = await retryService.cleanupOldJobs(daysOld);

      return c.json({
        success: true,
        message: `Cleaned up ${deletedCount} old failed jobs`,
        deletedCount
      });

    } catch (error) {
      console.error('Failed to cleanup jobs:', error);

      throw new HTTPException(500, {
        message: 'Failed to cleanup old jobs'
      });
    }
  });

  // Start/stop retry processor
  routes.post('/processor/start', async (c) => {
    try {
      const intervalMs = 30000; // 30 seconds
      retryService.startRetryProcessor(intervalMs);

      return c.json({
        success: true,
        message: 'Retry processor started',
        intervalMs
      });

    } catch (error) {
      console.error('Failed to start retry processor:', error);

      throw new HTTPException(500, {
        message: 'Failed to start retry processor'
      });
    }
  });

  routes.post('/processor/stop', async (c) => {
    try {
      retryService.stopRetryProcessor();

      return c.json({
        success: true,
        message: 'Retry processor stopped'
      });

    } catch (error) {
      console.error('Failed to stop retry processor:', error);

      throw new HTTPException(500, {
        message: 'Failed to stop retry processor'
      });
    }
  });

  return routes;
}