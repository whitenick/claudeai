import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { RetryService } from '../services/retry-service.js';
import { z } from 'zod';

const retryJobSchema = z.object({
  jobId: z.string().uuid()
});

const cleanupJobsSchema = z.object({
  daysOld: z.number().min(1).max(365).default(30)
});

export async function failedJobsRoutes(
  fastify: FastifyInstance,
  options: FastifyPluginOptions
): Promise<void> {

  const retryService = new RetryService();

  // Get failed jobs statistics
  fastify.get('/stats', async (request, reply) => {
    try {
      const stats = await retryService.getFailedJobsStats();

      return {
        success: true,
        stats
      };
    } catch (error) {
      fastify.log.error('Failed to get failed jobs stats:', error);

      reply.code(500);
      return {
        success: false,
        error: 'Failed to get failed jobs statistics'
      };
    }
  });

  // Manually retry a specific job
  fastify.post('/retry/:jobId', async (request, reply) => {
    try {
      const { jobId } = request.params as { jobId: string };

      // Validate jobId is UUID
      retryJobSchema.parse({ jobId });

      await retryService.retryJobById(jobId);

      return {
        success: true,
        message: `Job ${jobId} queued for retry`
      };

    } catch (error) {
      fastify.log.error('Failed to retry job:', error);

      if (error instanceof Error && error.name === 'ZodError') {
        reply.code(400);
        return {
          success: false,
          error: 'Invalid job ID format'
        };
      }

      reply.code(500);
      return {
        success: false,
        error: `Failed to retry job: ${error.message}`
      };
    }
  });

  // Cleanup old abandoned jobs
  fastify.delete('/cleanup', async (request, reply) => {
    try {
      const { daysOld } = cleanupJobsSchema.parse(request.query || {});
      const deletedCount = await retryService.cleanupOldJobs(daysOld);

      return {
        success: true,
        message: `Cleaned up ${deletedCount} old failed jobs`,
        deletedCount
      };

    } catch (error) {
      fastify.log.error('Failed to cleanup jobs:', error);

      reply.code(500);
      return {
        success: false,
        error: 'Failed to cleanup old jobs'
      };
    }
  });

  // Start/stop retry processor
  fastify.post('/processor/start', async (request, reply) => {
    try {
      const intervalMs = 30000; // 30 seconds
      retryService.startRetryProcessor(intervalMs);

      return {
        success: true,
        message: 'Retry processor started',
        intervalMs
      };

    } catch (error) {
      fastify.log.error('Failed to start retry processor:', error);

      reply.code(500);
      return {
        success: false,
        error: 'Failed to start retry processor'
      };
    }
  });

  fastify.post('/processor/stop', async (request, reply) => {
    try {
      retryService.stopRetryProcessor();

      return {
        success: true,
        message: 'Retry processor stopped'
      };

    } catch (error) {
      fastify.log.error('Failed to stop retry processor:', error);

      reply.code(500);
      return {
        success: false,
        error: 'Failed to stop retry processor'
      };
    }
  });
}