-- Initial schema for admin notes AI POC

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Admin notes table
CREATE TABLE admin_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL,
    content TEXT NOT NULL,
    author_id UUID NOT NULL,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- AI summaries table
CREATE TABLE ai_summaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL,
    summary TEXT NOT NULL,
    note_count INTEGER NOT NULL,
    last_processed_note_id UUID NOT NULL,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Indexes for performance
CREATE INDEX idx_admin_notes_student_id ON admin_notes(student_id);
CREATE INDEX idx_admin_notes_created_at ON admin_notes(created_at DESC);
CREATE INDEX idx_ai_summaries_student_id ON ai_summaries(student_id);

-- Trigger function for pub/sub notifications
CREATE OR REPLACE FUNCTION notify_admin_note_created()
RETURNS TRIGGER AS $$
BEGIN
    -- Notify with JSON payload containing event data
    PERFORM pg_notify('admin_notes_created', json_build_object(
        'id', NEW.id,
        'student_id', NEW.student_id,
        'author_id', NEW.author_id,
        'created_at', NEW.created_at,
        'event_type', 'admin_note_created'
    )::text);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on admin_notes INSERT
CREATE TRIGGER admin_note_created_trigger
    AFTER INSERT ON admin_notes
    FOR EACH ROW
    EXECUTE FUNCTION notify_admin_note_created();

-- Function to notify AI summary completion
CREATE OR REPLACE FUNCTION notify_summary_completed()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM pg_notify('summary_completed', json_build_object(
        'id', NEW.id,
        'student_id', NEW.student_id,
        'note_count', NEW.note_count,
        'created_at', NEW.created_at,
        'event_type', 'summary_completed'
    )::text);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on ai_summaries INSERT
CREATE TRIGGER ai_summary_completed_trigger
    AFTER INSERT ON ai_summaries
    FOR EACH ROW
    EXECUTE FUNCTION notify_summary_completed();