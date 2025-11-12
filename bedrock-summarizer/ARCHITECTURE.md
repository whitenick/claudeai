# Bedrock Summarizer - Architecture Documentation

## Service Overview

The Bedrock Summarizer is a Spring Boot microservice following the FloRecruit microservices architecture pattern. It provides AI-powered summarization capabilities using AWS Bedrock foundation models.

## Architecture Pattern

This service follows the **communication-service** architecture pattern from the FloRecruitSpringBoot monorepo:

- **Java 21 LTS** with modern language features
- **Spring Boot 3.5.3** framework
- **JOOQ** for type-safe database access
- **Flyway** for database migrations
- **PostgreSQL** with event-driven architecture
- **Docker** containerization
- **Gradle** build system

## Layer Architecture

```
┌─────────────────────────────────────────┐
│         REST Controllers                │
│  - SummaryController                     │
│  - HealthController                      │
└──────────────┬──────────────────────────┘
               │
┌──────────────▼──────────────────────────┐
│         Service Layer                    │
│  - SummaryGenerationService              │
│  - BedrockAiService                      │
└──────────────┬──────────────────────────┘
               │
┌──────────────▼──────────────────────────┐
│         Repository Layer                 │
│  - AdminNoteRepository (JOOQ)            │
│  - AiSummaryRepository (JOOQ)            │
└──────────────┬──────────────────────────┘
               │
┌──────────────▼──────────────────────────┐
│         PostgreSQL Database              │
│  - admin_notes table                     │
│  - ai_summaries table                    │
└──────────────────────────────────────────┘

         External Integration
┌──────────────────────────────────────────┐
│         AWS Bedrock                       │
│  - BedrockRuntimeClient                   │
│  - Foundation Models                      │
└──────────────────────────────────────────┘
```

## Key Components

### 1. Controllers (`controller/`)

**SummaryController** - REST API for summary operations
- `POST /summaries/generate` - Generate AI summary
- `GET /summaries/student/{id}` - Get summaries for student
- `POST /summaries/batch` - Batch generation
- `GET /summaries/stats` - Statistics

**HealthController** - Service monitoring
- `GET /health` - Basic health check
- `GET /health/status` - Detailed status
- `GET /health/bedrock` - AWS Bedrock connectivity

### 2. Service Layer (`service/`, `aws/`)

**SummaryGenerationService**
- Orchestrates summary generation workflow
- Manages batch processing
- Handles business logic and validation

**BedrockAiService**
- AWS Bedrock SDK integration
- Model invocation and response parsing
- Multi-model support with fallback
- Error handling and retry logic

### 3. Domain Models (`domain/`)

**AdminNote**
- Represents educational administrative notes
- Links to students and authors
- Timestamp tracking

**AiSummary**
- Generated AI summaries
- Links to source notes
- Metadata (model used, token count, generation time)

### 4. Configuration (`config/`)

**AwsBedrockConfig**
- AWS SDK client initialization
- BedrockRuntimeClient configuration
- SecretsManagerClient setup
- Region and credentials management

### 5. Exception Handling (`exception/`)

**BedrockServiceException**
- Custom exception for AWS Bedrock failures
- Wraps SDK exceptions with context
- Used throughout service layer

## Database Schema

### Tables

**admin_notes**
```sql
- id: UUID (PK)
- student_id: UUID (indexed)
- content: TEXT
- author_id: UUID (indexed)
- created_at: TIMESTAMP (indexed)
- updated_at: TIMESTAMP
```

**ai_summaries**
```sql
- id: UUID (PK)
- student_id: UUID (indexed)
- summary: TEXT
- note_ids: UUID[] (array of note IDs)
- model_used: VARCHAR(100)
- token_count: INTEGER
- generation_time_ms: BIGINT
- created_at: TIMESTAMP (indexed)
```

### Event System

**PostgreSQL NOTIFY/LISTEN**
- Trigger on `admin_notes` INSERT
- Emits `admin_notes_created` event
- Enables async summary generation
- Decouples note creation from AI processing

## AWS Bedrock Integration

### Model Strategy

**Primary Model: Amazon Titan Text Express**
- Model ID: `amazon.titan-text-express-v1`
- Cost-effective, fast inference
- Good for high-volume processing

**Fallback Model: Anthropic Claude v2**
- Model ID: `anthropic.claude-v2`
- Superior reasoning capabilities
- Better for complex summaries

### Request/Response Flow

1. Service builds prompt from admin notes
2. Constructs model-specific request body
3. Invokes Bedrock via `BedrockRuntimeClient`
4. Parses model-specific response format
5. Extracts summary text
6. Records metadata (tokens, time, model)

### Error Handling

- Primary model failure → Automatic fallback to secondary
- Both models fail → `BedrockServiceException` thrown
- Logged with correlation IDs for debugging
- Monitoring metrics captured

## Configuration Properties

### Core Settings
```properties
server.port=8083
server.servlet.context-path=/api/v2/summarizer
```

### AWS Bedrock
```properties
aws.region=us-east-1
aws.bedrock.model-id=amazon.titan-text-express-v1
aws.bedrock.fallback-model-id=anthropic.claude-v2
aws.bedrock.max-tokens=2000
aws.bedrock.temperature=0.1
```

### Summarization
```properties
summarization.batch.max-notes-per-summary=50
summarization.batch.default-note-limit=20
summarization.cache.enabled=true
summarization.cache.ttl-minutes=60
```

### Database
```properties
spring.datasource.url=jdbc:postgresql://localhost:5432/bedrock_summarizer
spring.datasource.maximum-pool-size=20
spring.datasource.minimum-idle=5
```

## Observability

### Metrics (via Micrometer/Prometheus)
- Summary generation count
- Average generation time
- Token usage
- Model failure rates
- Database query performance

### Health Checks
- Application health (`/health`)
- Detailed status (`/health/status`)
- Bedrock connectivity (`/health/bedrock`)
- Database connectivity (via Actuator)

### Logging
- Structured logging with SLF4J/Logback
- Request correlation IDs
- AWS SDK request IDs
- Performance timing logs

## Security Considerations

### AWS Credentials
- Uses `DefaultCredentialsProvider`
- Supports: IAM roles, environment variables, profiles
- Never hardcoded in source

### IAM Permissions Required
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

### Database Security
- Connection pooling with HikariCP
- SSL mode configurable per environment
- Prepared statements via JOOQ (SQL injection prevention)

## Deployment Architecture

### Local Development
```
Developer Machine
  ├── Spring Boot App (port 8083)
  ├── PostgreSQL (Docker, port 5432)
  └── LocalStack (optional, port 4566)
```

### Production (AWS ECS)
```
AWS Cloud
  ├── ECS Service (Fargate)
  │   └── Bedrock Summarizer Container
  ├── RDS PostgreSQL (managed)
  ├── AWS Bedrock (managed AI service)
  ├── CloudWatch (logging/metrics)
  └── Application Load Balancer
```

## Integration with FloRecruit Monorepo

To integrate into the monorepo:

1. **Copy service to monorepo root**
   ```bash
   cp -r bedrock-summarizer ~/Development/Github/FloRecruitSpringBoot/
   ```

2. **Update `settings.gradle`**
   ```gradle
   include 'bedrock-summarizer'
   ```

3. **Add common dependencies**
   ```gradle
   dependencies {
       implementation project(':common-auth')
       implementation project(':common-api')
   }
   ```

4. **Update package scanning**
   ```java
   @SpringBootApplication(
       scanBasePackages = {
           "com.flo.bedrock_summarizer",
           "com.flo.common_auth",
           "com.flo.common_lib"
       }
   )
   ```

## Testing Strategy

### Unit Tests
- Service layer logic
- AWS Bedrock response parsing
- Domain model validation
- Mock AWS SDK clients

### Integration Tests
- Full Spring Boot context
- Testcontainers for PostgreSQL
- Mock Bedrock responses
- End-to-end API testing

### Coverage Goals
- Line coverage: 75%+
- Branch coverage: 33%+
- Exclude generated code (JOOQ)

## Performance Characteristics

### Expected Latency
- Summary generation: 2-5 seconds (p95)
- Database queries: <100ms (p95)
- Health checks: <50ms (p95)

### Throughput
- Target: 1000 requests/minute
- Batch processing: 10 students/request

### Resource Usage
- Memory: ~512MB base, ~1GB under load
- CPU: Minimal (I/O bound workload)
- Database connections: 5-20 concurrent

## Cost Analysis

### AWS Bedrock Costs
**Amazon Titan Text Express:**
- Input: $0.0003/1K tokens
- Output: $0.0004/1K tokens

**Monthly estimate (10,000 summaries):**
- Input: 10K × 0.5K tokens × $0.0003 = $1.50
- Output: 10K × 0.2K tokens × $0.0004 = $0.80
- **Total: ~$2.30/month**

### Infrastructure Costs
- RDS PostgreSQL: ~$50-100/month
- ECS Fargate: ~$30-50/month
- Data transfer: ~$5-10/month

## Future Enhancements

### Short Term
- [ ] Repository layer implementation (JOOQ)
- [ ] Event listener for async processing
- [ ] Summary caching with Redis
- [ ] Additional unit/integration tests

### Medium Term
- [ ] WebSocket support for real-time updates
- [ ] Custom summary templates
- [ ] Multi-language support
- [ ] Advanced analytics dashboard

### Long Term
- [ ] Fine-tuned models for education domain
- [ ] GraphQL API layer
- [ ] Multi-tenant architecture
- [ ] Machine learning feedback loop

## Dependencies

### Key Libraries
- Spring Boot 3.5.3
- AWS SDK for Java 2.x
- JOOQ 3.20.2
- PostgreSQL Driver 42.7.5
- Flyway 11.11.1
- Lombok 1.18.x
- MapStruct 1.6.3
- SpringDoc OpenAPI 2.8.9

## Development Guidelines

1. **Follow existing patterns** from communication-service
2. **Use Java 21 features** (records, pattern matching, text blocks)
3. **Write tests** for all business logic
4. **Document APIs** with Swagger annotations
5. **Log with correlation IDs** for request tracing
6. **Handle errors gracefully** with proper exception types
7. **Optimize for cost** - monitor token usage

## References

- [Project Proposal](PROJECT_PROPOSAL.md)
- [README](README.md)
- [Communication Service](~/Development/Github/FloRecruitSpringBoot/communication-service)
- [AWS Bedrock Documentation](https://docs.aws.amazon.com/bedrock/)
- [Spring Boot 3 Reference](https://docs.spring.io/spring-boot/docs/3.5.3/reference/html/)

---

**Last Updated:** 2025-10-13
**Version:** 1.0
**Author:** Technical Architecture Team
