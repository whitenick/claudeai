import { db, notificationClient } from '../db/index.js';
import { failedJobs, jobRetryLog } from '../db/failed-jobs-schema.js';
import { AdminNoteCreatedEvent } from '../types/events.js';
import { AIService } from './ai-service.js';
import { eq, and, lte, sql } from 'drizzle-orm';

export class RetryService {
  private aiService: AIService;
  private isRunning = false;
  private retryInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.aiService = new AIService();
  }

  /**
   * Record a failed job for later retry
   */
  async recordFailedJob(
    jobType: string,
    payload: any,
    error: Error,
    maxRetries: number = 3
  ): Promise<void> {
    try {
      const nextRetryAt = this.calculateNextRetry(1);

      await db.insert(failedJobs).values({
        jobType,
        payload,
        error: error.message,
        errorStack: error.stack,
        attemptCount: 1,
        maxRetries,
        nextRetryAt,
        status: 'failed'
      });

      console.log(`📝 Recorded failed job: ${jobType} - ${error.message}`);

      // Notify about failed job
      await notificationClient.unsafe(`
        SELECT pg_notify('job_failed', '${JSON.stringify({
          job_type: jobType,
          error: error.message,
          timestamp: new Date().toISOString()
        })}')
      `);

    } catch (recordError) {
      console.error('❌ Failed to record failed job:', recordError);
      // Don't throw here to avoid infinite loops
    }
  }

  /**
   * Start the retry processor
   */
  startRetryProcessor(intervalMs: number = 30000): void {
    if (this.isRunning) {
      console.log('⚠️  Retry processor already running');
      return;
    }

    console.log(`🔄 Starting retry processor (checking every ${intervalMs}ms)`);
    this.isRunning = true;

    this.retryInterval = setInterval(async () => {
      await this.processRetries();
    }, intervalMs);
  }

  /**
   * Stop the retry processor
   */
  stopRetryProcessor(): void {
    if (this.retryInterval) {
      clearInterval(this.retryInterval);
      this.retryInterval = null;
    }
    this.isRunning = false;
    console.log('🛑 Retry processor stopped');
  }

  /**
   * Process pending retries
   */
  private async processRetries(): Promise<void> {
    try {
      // Get jobs ready for retry
      const jobsToRetry = await db
        .select()
        .from(failedJobs)
        .where(
          and(
            eq(failedJobs.status, 'failed'),
            lte(failedJobs.nextRetryAt, new Date()),
            sql`${failedJobs.attemptCount} < ${failedJobs.maxRetries}`
          )
        )
        .limit(10); // Process max 10 jobs at once

      if (jobsToRetry.length === 0) {
        return; // No jobs to retry
      }

      console.log(`🔄 Processing ${jobsToRetry.length} failed jobs for retry`);

      for (const job of jobsToRetry) {
        await this.retryJob(job);
      }

    } catch (error) {
      console.error('❌ Error processing retries:', error);
    }
  }

  /**
   * Retry a specific job
   */
  private async retryJob(job: any): Promise<void> {
    console.log(`🔄 Retrying job ${job.id} (attempt ${job.attemptCount + 1}/${job.maxRetries})`);

    try {
      // Update status to retrying
      await db
        .update(failedJobs)
        .set({
          status: 'retrying',
          lastAttemptedAt: new Date()
        })
        .where(eq(failedJobs.id, job.id));

      // Attempt to process the job based on type
      await this.executeJob(job.jobType, job.payload);

      // Job succeeded - remove from failed jobs
      await db.delete(failedJobs).where(eq(failedJobs.id, job.id));

      console.log(`✅ Job ${job.id} retried successfully`);

      // Notify success
      await notificationClient.unsafe(`
        SELECT pg_notify('job_retry_success', '${JSON.stringify({
          job_id: job.id,
          job_type: job.jobType,
          attempt_count: job.attemptCount + 1,
          timestamp: new Date().toISOString()
        })}')
      `);

    } catch (error) {
      await this.handleRetryFailure(job, error as Error);
    }
  }

  /**
   * Handle retry failure
   */
  private async handleRetryFailure(job: any, error: Error): Promise<void> {
    const newAttemptCount = job.attemptCount + 1;
    const hasMoreRetries = newAttemptCount < job.maxRetries;

    // Log the retry attempt
    await db.insert(jobRetryLog).values({
      failedJobId: job.id,
      attemptNumber: newAttemptCount,
      error: error.message
    });

    if (hasMoreRetries) {
      // Schedule next retry with exponential backoff
      const nextRetryAt = this.calculateNextRetry(newAttemptCount);

      await db
        .update(failedJobs)
        .set({
          status: 'failed',
          attemptCount: newAttemptCount,
          nextRetryAt,
          error: error.message,
          errorStack: error.stack,
          lastAttemptedAt: new Date()
        })
        .where(eq(failedJobs.id, job.id));

      console.log(`⏰ Job ${job.id} scheduled for retry ${newAttemptCount}/${job.maxRetries} at ${nextRetryAt}`);

    } else {
      // Max retries reached - mark as abandoned
      await db
        .update(failedJobs)
        .set({
          status: 'abandoned',
          attemptCount: newAttemptCount,
          error: error.message,
          errorStack: error.stack,
          lastAttemptedAt: new Date()
        })
        .where(eq(failedJobs.id, job.id));

      console.log(`❌ Job ${job.id} abandoned after ${newAttemptCount} attempts`);

      // Notify about abandoned job
      await notificationClient.unsafe(`
        SELECT pg_notify('job_abandoned', '${JSON.stringify({
          job_id: job.id,
          job_type: job.jobType,
          final_error: error.message,
          total_attempts: newAttemptCount,
          timestamp: new Date().toISOString()
        })}')
      `);
    }
  }

  /**
   * Execute a job based on its type
   */
  private async executeJob(jobType: string, payload: any): Promise<void> {
    switch (jobType) {
      case 'admin_note_summary':
        await this.aiService.processAdminNoteCreated(payload as AdminNoteCreatedEvent);
        break;

      default:
        throw new Error(`Unknown job type: ${jobType}`);
    }
  }

  /**
   * Calculate next retry time with exponential backoff
   */
  private calculateNextRetry(attemptCount: number): Date {
    // Exponential backoff: 1min, 5min, 15min, 30min, 1hr
    const delays = [60, 300, 900, 1800, 3600]; // seconds
    const delayIndex = Math.min(attemptCount - 1, delays.length - 1);
    const baseDelay = delays[delayIndex];

    // Add jitter (±25%)
    const jitter = 0.25;
    const jitterOffset = (Math.random() - 0.5) * 2 * jitter;
    const finalDelay = baseDelay * (1 + jitterOffset);

    const nextRetry = new Date();
    nextRetry.setSeconds(nextRetry.getSeconds() + finalDelay);

    return nextRetry;
  }

  /**
   * Get failed jobs statistics
   */
  async getFailedJobsStats(): Promise<{
    total: number;
    byType: Record<string, number>;
    byStatus: Record<string, number>;
  }> {
    const jobs = await db.select().from(failedJobs);

    const byType: Record<string, number> = {};
    const byStatus: Record<string, number> = {};

    jobs.forEach(job => {
      byType[job.jobType] = (byType[job.jobType] || 0) + 1;
      byStatus[job.status] = (byStatus[job.status] || 0) + 1;
    });

    return {
      total: jobs.length,
      byType,
      byStatus
    };
  }

  /**
   * Manually retry a specific job
   */
  async retryJobById(jobId: string): Promise<void> {
    const job = await db
      .select()
      .from(failedJobs)
      .where(eq(failedJobs.id, jobId))
      .limit(1);

    if (job.length === 0) {
      throw new Error(`Job ${jobId} not found`);
    }

    await this.retryJob(job[0]);
  }

  /**
   * Clear old abandoned jobs (cleanup)
   */
  async cleanupOldJobs(daysOld: number = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const result = await db
      .delete(failedJobs)
      .where(
        and(
          eq(failedJobs.status, 'abandoned'),
          lte(failedJobs.failedAt, cutoffDate)
        )
      );

    console.log(`🧹 Cleaned up old failed jobs older than ${daysOld} days`);
    return result.rowCount || 0;
  }
}