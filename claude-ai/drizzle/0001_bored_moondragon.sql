CREATE TABLE IF NOT EXISTS "failed_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"error" text NOT NULL,
	"error_stack" text,
	"attempt_count" integer DEFAULT 1 NOT NULL,
	"max_retries" integer DEFAULT 3 NOT NULL,
	"next_retry_at" timestamp,
	"failed_at" timestamp DEFAULT now() NOT NULL,
	"last_attempted_at" timestamp DEFAULT now() NOT NULL,
	"status" text DEFAULT 'failed' NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "job_retry_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"failed_job_id" uuid NOT NULL,
	"attempt_number" integer NOT NULL,
	"error" text NOT NULL,
	"attempted_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "job_retry_log" ADD CONSTRAINT "job_retry_log_failed_job_id_failed_jobs_id_fk" FOREIGN KEY ("failed_job_id") REFERENCES "failed_jobs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
