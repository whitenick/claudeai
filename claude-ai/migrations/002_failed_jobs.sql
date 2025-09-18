-- Migration: Create failed jobs and retry log tables
-- Created: 2025-01-19

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Failed jobs table for tracking job failures and retries
CREATE TABLE failed_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_type TEXT NOT NULL, -- 'admin_note_summary', etc.
    payload JSONB NOT NULL, -- Original event data
    error TEXT NOT NULL,
    error_stack TEXT,
    attempt_count INTEGER DEFAULT 1 NOT NULL,
    max_retries INTEGER DEFAULT 3 NOT NULL,
    next_retry_at TIMESTAMP,
    failed_at TIMESTAMP DEFAULT NOW() NOT NULL,
    last_attempted_at TIMESTAMP DEFAULT NOW() NOT NULL,
    status TEXT DEFAULT 'failed' NOT NULL -- 'failed', 'retrying', 'abandoned'
);

-- Job retry log table for tracking individual retry attempts
CREATE TABLE job_retry_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    failed_job_id UUID REFERENCES failed_jobs(id) NOT NULL,
    attempt_number INTEGER NOT NULL,
    error TEXT NOT NULL,
    attempted_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Indexes for performance
CREATE INDEX idx_failed_jobs_status ON failed_jobs(status);
CREATE INDEX idx_failed_jobs_next_retry ON failed_jobs(next_retry_at) WHERE status = 'failed';
CREATE INDEX idx_failed_jobs_job_type ON failed_jobs(job_type);
CREATE INDEX idx_retry_log_job_id ON job_retry_log(failed_job_id);

-- Comments
COMMENT ON TABLE failed_jobs IS 'Tracks failed background jobs for retry processing';
COMMENT ON TABLE job_retry_log IS 'Logs individual retry attempts for failed jobs';
COMMENT ON COLUMN failed_jobs.status IS 'Job status: failed (ready for retry), retrying (currently being processed), abandoned (max retries reached)';
COMMENT ON COLUMN failed_jobs.payload IS 'Original event data that triggered the job';