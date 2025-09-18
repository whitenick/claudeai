import { pgTable, text, timestamp, uuid, integer, jsonb } from 'drizzle-orm/pg-core';

export const failedJobs = pgTable('failed_jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  jobType: text('job_type').notNull(), // 'admin_note_summary'
  payload: jsonb('payload').notNull(), // Original event data
  error: text('error').notNull(),
  errorStack: text('error_stack'),
  attemptCount: integer('attempt_count').default(1).notNull(),
  maxRetries: integer('max_retries').default(3).notNull(),
  nextRetryAt: timestamp('next_retry_at'),
  failedAt: timestamp('failed_at').defaultNow().notNull(),
  lastAttemptedAt: timestamp('last_attempted_at').defaultNow().notNull(),
  status: text('status').default('failed').notNull() // 'failed', 'retrying', 'abandoned'
});

export const jobRetryLog = pgTable('job_retry_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  failedJobId: uuid('failed_job_id').references(() => failedJobs.id).notNull(),
  attemptNumber: integer('attempt_number').notNull(),
  error: text('error').notNull(),
  attemptedAt: timestamp('attempted_at').defaultNow().notNull()
});

// Type inference
export type FailedJob = typeof failedJobs.$inferSelect;
export type NewFailedJob = typeof failedJobs.$inferInsert;
export type JobRetryLog = typeof jobRetryLog.$inferSelect;