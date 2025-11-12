# Bedrock Summarizer Service

## Overview

A Spring Boot microservice that provides AI-powered summarization of administrative notes using AWS Bedrock foundation models. This service is designed to integrate seamlessly into the FloRecruit microservices architecture.

## Key Features

- AI-powered note summarization using AWS Bedrock
- Support for multiple foundation models (Amazon Titan, Anthropic Claude)
- Automatic fallback to alternative models
- Async event-driven architecture with PostgreSQL NOTIFY/LISTEN
- Batch processing capabilities
- Comprehensive health checks and monitoring
- RESTful API with OpenAPI/Swagger documentation

## Technology Stack

- **Java 21 LTS** - Latest long-term support version
- **Spring Boot 3.5.3** - Latest Spring Boot framework
- **AWS Bedrock** - Managed AI/ML service for foundation models
- **PostgreSQL 15** - Primary database with event system
- **JOOQ** - Type-safe SQL query builder
- **Flyway** - Database migration management
- **Gradle 8.10** - Build system with Kotlin DSL
- **Docker** - Containerization

## Project Structure

```
bedrock-summarizer/
├── src/
│   ├── main/
│   │   ├── java/com/flo/bedrock_summarizer/
│   │   │   ├── BedrockSummarizerApplication.java
│   │   │   ├── aws/
│   │   │   │   └── BedrockAiService.java        # AWS Bedrock integration
│   │   │   ├── config/
│   │   │   │   └── AwsBedrockConfig.java        # AWS SDK configuration
│   │   │   ├── controller/
│   │   │   │   ├── SummaryController.java       # Summary REST API
│   │   │   │   └── HealthController.java        # Health checks
│   │   │   ├── domain/
│   │   │   │   ├── AdminNote.java               # Note domain model
│   │   │   │   └── AiSummary.java               # Summary domain model
│   │   │   ├── service/
│   │   │   │   └── SummaryGenerationService.java # Business logic
│   │   │   ├── repository/                      # Data access layer
│   │   │   └── exception/
│   │   │       └── BedrockServiceException.java
│   │   └── resources/
│   │       ├── application-local.properties
│   │       └── db/migration/
│   │           └── V1__initial_schema.sql
│   └── test/
│       └── java/com/flo/bedrock_summarizer/
├── build.gradle
├── docker-compose.yml
├── Dockerfile
└── README.md
```

## API Endpoints

### AI Summaries

- `POST /api/v2/summarizer/summaries/generate` - Generate AI summary from notes
  - Query param: `studentId` (UUID)
  - Body: List of AdminNote objects
  - Returns: Generated AiSummary

- `GET /api/v2/summarizer/summaries/student/{studentId}` - Get all summaries for a student
- `GET /api/v2/summarizer/summaries/{summaryId}` - Get specific summary by ID
- `POST /api/v2/summarizer/summaries/batch` - Generate summaries for multiple students
- `GET /api/v2/summarizer/summaries/stats` - Get summary generation statistics

### Health & Monitoring

- `GET /api/v2/summarizer/health` - Basic health check
- `GET /api/v2/summarizer/health/status` - Detailed service status
- `GET /api/v2/summarizer/health/bedrock` - AWS Bedrock connectivity check
- `GET /api/v2/summarizer/health/ping` - Simple ping endpoint

### API Documentation

- `/api/v2/summarizer/swagger-ui.html` - Interactive API documentation
- `/api/v2/summarizer/api-docs` - OpenAPI specification

## Running the Service

### Prerequisites

- **Java 21** (install via SDKMAN)
- **Docker** and **Docker Compose**
- **PostgreSQL 15** (via Docker Compose)
- **AWS credentials** configured (for Bedrock access)

### Install Java 21

```bash
sdk install java 21.0.7-amzn
sdk use java 21.0.7-amzn
```

### Local Development Setup

1. **Start PostgreSQL database:**
   ```bash
   docker compose up -d postgres
   ```

2. **Configure environment variables:**
   Edit `.env.local` with your database and AWS configuration

3. **Run database migrations:**
   ```bash
   ./gradlew flywayMigrate
   ```

4. **Generate JOOQ classes:**
   ```bash
   ./gradlew generateJooq
   ```

5. **Run the service:**
   ```bash
   ./gradlew bootRun
   ```

   The service will start on http://localhost:8083

### Running Tests

```bash
docker compose up -d postgres
./gradlew clean test
```

### Building for Production

```bash
./gradlew clean build
```

## AWS Bedrock Configuration

### Model Selection

The service supports multiple AWS Bedrock foundation models:

**Primary Model: Amazon Titan Text Express**
- Model ID: `amazon.titan-text-express-v1`
- Cost-effective for high-volume processing
- Fast inference times

**Fallback Model: Anthropic Claude**
- Model ID: `anthropic.claude-v2`
- Superior reasoning and context understanding
- Better for complex summaries

### AWS Credentials

For local development:
```bash
# Configure AWS CLI
aws configure

# Or use environment variables
export AWS_ACCESS_KEY_ID=your_key
export AWS_SECRET_ACCESS_KEY=your_secret
export AWS_REGION=us-east-1
```

For production, use IAM roles with appropriate Bedrock permissions.

### Required IAM Permissions

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "bedrock:InvokeModel",
        "bedrock:ListFoundationModels"
      ],
      "Resource": "*"
    }
  ]
}
```

## Database Schema

### Admin Notes Table
```sql
CREATE TABLE bedrock_summarizer.admin_notes (
    id UUID PRIMARY KEY,
    student_id UUID NOT NULL,
    content TEXT NOT NULL,
    author_id UUID NOT NULL,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL
);
```

### AI Summaries Table
```sql
CREATE TABLE bedrock_summarizer.ai_summaries (
    id UUID PRIMARY KEY,
    student_id UUID NOT NULL,
    summary TEXT NOT NULL,
    note_ids UUID[] NOT NULL,
    model_used VARCHAR(100),
    token_count INTEGER,
    generation_time_ms BIGINT,
    created_at TIMESTAMP NOT NULL
);
```

## Event-Driven Architecture

The service uses PostgreSQL NOTIFY/LISTEN for asynchronous processing:

1. New admin note is inserted
2. Database trigger fires `admin_notes_created` event
3. Service listener receives notification
4. Summary generation is triggered automatically

This decouples note creation from summary generation for better performance.

## Configuration Properties

Key configuration options in `application-local.properties`:

```properties
# AWS Bedrock
aws.region=us-east-1
aws.bedrock.model-id=amazon.titan-text-express-v1
aws.bedrock.fallback-model-id=anthropic.claude-v2
aws.bedrock.max-tokens=2000
aws.bedrock.temperature=0.1

# Summarization
summarization.batch.max-notes-per-summary=50
summarization.batch.default-note-limit=20
summarization.cache.enabled=true
summarization.cache.ttl-minutes=60
```

## Monitoring & Observability

### Metrics
- Summary generation success/failure rates
- AWS Bedrock API latency
- Token usage per request
- Database query performance

### Health Checks
- Service health: `/health`
- Detailed status: `/health/status`
- Bedrock connectivity: `/health/bedrock`

### Prometheus Metrics
Available at `/actuator/prometheus`

## Cost Estimation

**Amazon Titan Text Express Pricing:**
- Input: $0.0003 per 1K tokens
- Output: $0.0004 per 1K tokens

**Example Monthly Cost (10,000 summaries):**
- Average 500 input tokens per summary
- Average 200 output tokens per summary
- Total: ~$2.30/month

## Integration with FloRecruit Monorepo

To add this service to the FloRecruit monorepo:

1. **Copy service directory** to monorepo root
2. **Update `settings.gradle`:**
   ```gradle
   include 'bedrock-summarizer'
   ```
3. **Add common dependencies:**
   ```gradle
   implementation project(':common-auth')
   implementation project(':common-api')
   ```

## Development Guidelines

- Use Java 21 features (records, pattern matching, text blocks)
- Follow Spring Boot 3.x conventions
- Write tests for all business logic (target: 75% coverage)
- Use JOOQ for type-safe database queries
- Document APIs with Swagger annotations
- Log with correlation IDs for tracing

## Future Enhancements

- [ ] Real-time summary updates via WebSocket
- [ ] Summary caching with Redis
- [ ] Multi-language support
- [ ] Custom summary templates
- [ ] Advanced analytics dashboard
- [ ] Integration with LMS systems
- [ ] Fine-tuned models for educational domain

## Troubleshooting

### Common Issues

**AWS Bedrock connectivity fails:**
- Verify AWS credentials are configured
- Check IAM permissions include Bedrock access
- Ensure correct AWS region is set

**Database connection errors:**
- Verify PostgreSQL is running: `docker compose ps`
- Check database credentials in `.env.local`
- Run migrations: `./gradlew flywayMigrate`

**JOOQ generation fails:**
- Ensure database schema is up to date
- Run migrations before JOOQ generation
- Check database connection settings

## Contributing

1. Follow existing code structure and patterns
2. Write tests for new features
3. Update documentation
4. Run `./gradlew checkCi` before committing

## Support

For questions or issues:
- Check the [Project Proposal](PROJECT_PROPOSAL.md) for detailed architecture
- Review existing services in FloRecruitSpringBoot monorepo
- Consult AWS Bedrock documentation

## License

Proprietary - FloRecruit Internal Use Only
