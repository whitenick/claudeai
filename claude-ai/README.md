# Admin Notes AI Summary POC

A proof-of-concept service for generating AI-powered summaries of admin notes using PostgreSQL pub/sub for event-driven processing.

## Project Goals

### Primary Objectives
- **Event-driven architecture** for processing admin notes with AI summarization
- **Lightweight POC** using modern TypeScript stack (Fastify + Drizzle + Bun)
- **PostgreSQL pub/sub** for reliable event messaging without external message queues
- **Claude AI integration** for generating intelligent summaries of student admin notes
- **Migration-ready design** to eventually replace with Java Spring Boot service

### Key Features
- ✅ **Multi-AI Provider Support**: Easily switch between Claude, ChatGPT, and other AI providers
- ✅ **Real-time AI summarization** triggered by database events
- ✅ **Rich text admin notes** support
- ✅ **Last 10 notes context** for comprehensive summaries
- ✅ **RESTful API** for creating notes and retrieving summaries
- ✅ **Provider abstraction layer** for seamless AI provider switching
- ✅ **Health checks and error handling** with provider-specific monitoring
- ✅ **Failed job retry system** with exponential backoff and dead letter queue
- ✅ **Docker support** for easy deployment

## Architecture Overview

```
Admin Note Created → PostgreSQL Trigger → NOTIFY Event
                                             ↓
Node.js Event Listener ← LISTEN ← PostgreSQL NOTIFY
         ↓
Fetch Last 10 Notes → Claude AI → Store Summary → NOTIFY Complete
```

### Components
- **Fastify**: Lightweight web framework for REST API
- **Drizzle ORM**: Type-safe database operations with PostgreSQL
- **PostgreSQL**: Database with pub/sub via LISTEN/NOTIFY
- **Claude AI**: AI summarization via Anthropic's API
- **Bun**: Fast package manager and runtime

## Quick Start

### Prerequisites
- Bun installed (`curl -fsSL https://bun.sh/install | bash`)
- PostgreSQL 15+ running locally or via Docker
- AI Provider API key:
  - **Claude**: API key from Anthropic
  - **OpenAI**: API key from OpenAI

### Installation

```bash
# Install dependencies
bun install

# Set up environment
cp .env.example .env
# Edit .env with your database URL and AI provider configuration

# Run database migrations
bun run db:generate
bun run db:migrate

# Start development server
bun run dev
```

### Using Docker

```bash
# Start PostgreSQL and app
docker-compose up -d

# Check logs
docker-compose logs -f app
```

## AI Provider Management

### Switch AI Providers
```bash
# Check current provider status
curl http://localhost:3000/api/ai/provider/status

# Get available providers
curl http://localhost:3000/api/ai/providers

# Switch to OpenAI
curl -X POST http://localhost:3000/api/ai/provider/switch \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "openai",
    "apiKey": "your_openai_api_key",
    "model": "gpt-4-turbo"
  }'

# Switch back to Claude
curl -X POST http://localhost:3000/api/ai/provider/switch \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "claude",
    "apiKey": "your_claude_api_key",
    "model": "claude-3-5-sonnet-20241022"
  }'
```

### Test AI Providers
```bash
# Run comprehensive AI provider tests
./scripts/test-ai-providers.sh
```

## API Usage

### Create Admin Note
```bash
curl -X POST http://localhost:3000/api/admin-notes \
  -H "Content-Type: application/json" \
  -d '{
    "studentId": "123e4567-e89b-12d3-a456-426614174000",
    "content": "Student showed excellent progress in mathematics today. Completed all assignments and helped other students.",
    "authorId": "456e7890-e89b-12d3-a456-426614174001"
  }'
```

### Get AI Summaries
```bash
curl http://localhost:3000/api/students/123e4567-e89b-12d3-a456-426614174000/summaries
```

### Health Check
```bash
curl http://localhost:3000/health
```

## Event Flow

1. **Admin Note Created** → Database trigger fires
2. **PostgreSQL NOTIFY** → `admin_notes_created` event published
3. **Node.js Listener** → Receives event and processes
4. **Data Retrieval** → Fetches last 10 notes for student
5. **AI Processing** → Claude generates summary
6. **Summary Storage** → Saves to database
7. **Completion Event** → `summary_completed` event published

## Failed Job Retry System

The service includes a comprehensive retry mechanism for handling AI processing failures:

### Retry Features
- **Exponential backoff**: 1min → 5min → 15min → 30min → 1hr delays
- **Jitter**: ±25% randomization to prevent thundering herd
- **Configurable max retries**: Default 3 attempts per job
- **Status tracking**: `failed` → `retrying` → `abandoned`
- **Retry logging**: Detailed attempt history for debugging

### Failed Jobs Management
```bash
# Get failed jobs statistics
curl http://localhost:3000/api/failed-jobs/stats

# Manually retry a specific job
curl -X POST http://localhost:3000/api/failed-jobs/retry/{jobId}

# Start/stop retry processor
curl -X POST http://localhost:3000/api/failed-jobs/processor/start
curl -X POST http://localhost:3000/api/failed-jobs/processor/stop

# Cleanup old abandoned jobs (30+ days)
curl -X DELETE "http://localhost:3000/api/failed-jobs/cleanup?daysOld=30"

# Test retry mechanism
bun run test:retry
```

### Monitoring Failed Jobs
```sql
-- Check failed jobs status
SELECT job_type, status, COUNT(*)
FROM failed_jobs
GROUP BY job_type, status;

-- View retry attempts for a specific job
SELECT frj.*, jrl.attempt_number, jrl.error, jrl.attempted_at
FROM failed_jobs frj
LEFT JOIN job_retry_log jrl ON frj.id = jrl.failed_job_id
WHERE frj.id = 'your-job-id'
ORDER BY jrl.attempt_number;
```

## Database Schema

```sql
-- Admin notes with rich text support
admin_notes (
  id UUID PRIMARY KEY,
  student_id UUID NOT NULL,
  content TEXT NOT NULL,        -- Rich text (HTML/Markdown)
  author_id UUID NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- AI-generated summaries
ai_summaries (
  id UUID PRIMARY KEY,
  student_id UUID NOT NULL,
  summary TEXT NOT NULL,
  note_count INTEGER NOT NULL,
  last_processed_note_id UUID NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Failed job tracking
failed_jobs (
  id UUID PRIMARY KEY,
  job_type TEXT NOT NULL,         -- 'admin_note_summary'
  payload JSONB NOT NULL,         -- Original event data
  error TEXT NOT NULL,
  error_stack TEXT,
  attempt_count INTEGER DEFAULT 1,
  max_retries INTEGER DEFAULT 3,
  next_retry_at TIMESTAMP,
  failed_at TIMESTAMP DEFAULT NOW(),
  last_attempted_at TIMESTAMP DEFAULT NOW(),
  status TEXT DEFAULT 'failed'    -- 'failed', 'retrying', 'abandoned'
);

-- Retry attempt history
job_retry_log (
  id UUID PRIMARY KEY,
  failed_job_id UUID REFERENCES failed_jobs(id),
  attempt_number INTEGER NOT NULL,
  error TEXT NOT NULL,
  attempted_at TIMESTAMP DEFAULT NOW()
);
```

## Migration to Spring Boot

This POC is designed to be easily replaceable with a Java Spring Boot service:

### Database Compatibility
- PostgreSQL schema remains identical
- Pub/sub events use standard PostgreSQL LISTEN/NOTIFY
- No application-specific database features

### Event Migration
```java
// Spring Boot equivalent
@Component
public class AdminNotesEventListener {

    @EventListener
    @Async
    public void handleAdminNoteCreated(String payload) {
        AdminNoteEvent event = objectMapper.readValue(payload, AdminNoteEvent.class);
        aiSummaryService.processAdminNote(event);
    }
}

@Service
public class PostgresEventListener {

    @PostConstruct
    public void startListening() {
        // Use Spring's @JmsListener or custom PostgreSQL listener
        pgConnection.createStatement()
            .execute("LISTEN admin_notes_created");
    }
}
```

### API Migration
```java
// Spring Boot REST controller
@RestController
@RequestMapping("/api")
public class AdminNotesController {

    @PostMapping("/admin-notes")
    public ResponseEntity<AdminNote> createNote(@RequestBody CreateAdminNoteRequest request) {
        AdminNote note = adminNotesService.createNote(request);
        return ResponseEntity.ok(note);
    }

    @GetMapping("/students/{studentId}/summaries")
    public List<AiSummary> getSummaries(@PathVariable UUID studentId) {
        return aiSummaryService.getSummariesForStudent(studentId);
    }
}
```

### Dependencies Migration
```xml
<!-- Spring Boot equivalent dependencies -->
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-web</artifactId>
</dependency>
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-data-jpa</artifactId>
</dependency>
<dependency>
    <groupId>org.postgresql</groupId>
    <artifactId>postgresql</artifactId>
</dependency>
```

### Key Migration Benefits
- **Zero database changes** - same schema and triggers
- **Same event payloads** - JSON format compatible
- **Same AI logic** - Claude API calls translate directly
- **Same REST endpoints** - API contracts remain identical
- **Proven architecture** - events and data flow validated in POC

## Development Notes

### Event Debugging
```sql
-- Monitor PostgreSQL notifications
SELECT pg_notify('test_channel', 'test message');
LISTEN test_channel;
```

### Database Tools
```bash
# Access Drizzle Studio
bun run db:studio

# Generate migration after schema changes
bun run db:generate

# Apply migrations
bun run db:migrate
```

### Testing AI Integration
```bash
# Seed test data
bun run db:seed

# Monitor logs for AI processing
docker-compose logs -f app | grep "AI"
```

## Production Considerations

### Before Spring Boot Migration
1. **Load Testing** - Validate PostgreSQL pub/sub performance
2. **Error Handling** - Implement dead letter queue for failed AI processing
3. **Monitoring** - Add metrics for event processing latency
4. **Security** - Add authentication and input validation
5. **Rate Limiting** - Protect Claude API from excessive calls

### Spring Boot Advantages
- **Enterprise Features** - Better monitoring, security, configuration
- **Team Familiarity** - Existing Java/Spring expertise
- **Ecosystem** - Rich Spring Boot ecosystem and tooling
- **Production Readiness** - Battle-tested enterprise patterns

## Contributing

This is a POC for architectural validation. Focus areas:

1. **Event reliability** - Ensure no lost events under load
2. **AI quality** - Optimize prompts for better summaries
3. **Performance** - Measure PostgreSQL pub/sub limits
4. **Migration prep** - Document any Java-specific considerations

---

**Next Steps**: Once POC validates the architecture, migrate to Spring Boot for production deployment.