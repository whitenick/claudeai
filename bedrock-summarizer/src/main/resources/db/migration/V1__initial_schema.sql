-- Create schema for bedrock summarizer service
CREATE SCHEMA IF NOT EXISTS bedrock_summarizer;

-- Admin Notes Table
CREATE TABLE bedrock_summarizer.admin_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL,
    content TEXT NOT NULL,
    author_id UUID NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for common queries
CREATE INDEX idx_admin_notes_student_id ON bedrock_summarizer.admin_notes(student_id);
CREATE INDEX idx_admin_notes_created_at ON bedrock_summarizer.admin_notes(created_at DESC);
CREATE INDEX idx_admin_notes_author_id ON bedrock_summarizer.admin_notes(author_id);

-- AI Summaries Table
CREATE TABLE bedrock_summarizer.ai_summaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL,
    summary TEXT NOT NULL,
    note_ids UUID[] NOT NULL,
    model_used VARCHAR(100),
    token_count INTEGER,
    generation_time_ms BIGINT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for summaries
CREATE INDEX idx_ai_summaries_student_id ON bedrock_summarizer.ai_summaries(student_id);
CREATE INDEX idx_ai_summaries_created_at ON bedrock_summarizer.ai_summaries(created_at DESC);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION bedrock_summarizer.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for admin_notes updated_at
CREATE TRIGGER update_admin_notes_updated_at
    BEFORE UPDATE ON bedrock_summarizer.admin_notes
    FOR EACH ROW
    EXECUTE FUNCTION bedrock_summarizer.update_updated_at_column();

-- Event notification function for new admin notes
CREATE OR REPLACE FUNCTION bedrock_summarizer.notify_admin_note_created()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM pg_notify('admin_notes_created',
        json_build_object(
            'id', NEW.id,
            'student_id', NEW.student_id,
            'author_id', NEW.author_id,
            'created_at', NEW.created_at
        )::text
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for async summary generation on note creation
CREATE TRIGGER admin_notes_created_trigger
    AFTER INSERT ON bedrock_summarizer.admin_notes
    FOR EACH ROW
    EXECUTE FUNCTION bedrock_summarizer.notify_admin_note_created();

-- Comments for documentation
COMMENT ON TABLE bedrock_summarizer.admin_notes IS 'Administrative notes created by educators about students';
COMMENT ON TABLE bedrock_summarizer.ai_summaries IS 'AI-generated summaries of admin notes using AWS Bedrock';
COMMENT ON COLUMN bedrock_summarizer.ai_summaries.note_ids IS 'Array of admin note IDs that were used to generate this summary';
COMMENT ON COLUMN bedrock_summarizer.ai_summaries.model_used IS 'AWS Bedrock model identifier used for generation';
COMMENT ON COLUMN bedrock_summarizer.ai_summaries.token_count IS 'Estimated token count for cost tracking';
COMMENT ON COLUMN bedrock_summarizer.ai_summaries.generation_time_ms IS 'Time taken to generate summary in milliseconds';
