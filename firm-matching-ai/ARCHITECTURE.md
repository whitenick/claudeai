# Firm Matching POC Architecture

## Overview

This document describes the architecture of the RAG-based firm matching POC, including component design, data flow, and integration points.

## System Components

### 1. Spring Boot Application Layer

**FirmMatchingApplication**
- Main entry point
- Configures Spring context
- Enables auto-configuration

**FirmMatchingController**
- REST API endpoints
- Request validation
- Response formatting
- Error handling

### 2. AWS Bedrock Integration Layer

**BedrockAgentService**
- Primary service for AI interactions
- Handles both agent-based and direct invocations
- Manages prompt engineering
- Parses AI responses

**AwsBedrockConfig**
- AWS SDK client configuration
- Credential provider setup
- Region configuration

### 3. Domain Model Layer

**StudentPreferences**
- Structured student preferences
- Practice area preferences
- Geography preferences
- Firm size, work arrangement, culture
- Query context

**FirmMatchResponse**
- Match results
- Firm summaries
- Match scores and reasons
- Metadata (tokens, response time)

## Data Flow

### POC Mode (Current Implementation)

```
1. Client Request
   ↓
2. FirmMatchingController.matchFirms()
   ↓
3. BedrockAgentService.matchFirms()
   ↓
4. Check if agent configured
   ├─ Yes → invokeAgent()
   └─ No  → matchFirmsDirectly()
   ↓
5. Build query from preferences
   ↓
6. Invoke AWS Bedrock
   ├─ Agent Mode: InvokeAgentRequest
   └─ Direct Mode: InvokeModelRequest (Claude)
   ↓
7. Parse AI response
   ↓
8. Build FirmMatchResponse
   ↓
9. Return to client
```

### Full RAG Mode (Future)

```
1. Client Request
   ↓
2. FirmMatchingController
   ↓
3. BedrockAgentService
   ↓
4. AWS Bedrock Agent
   ├─→ Knowledge Base Query
   │   ├─→ Vector Database (OpenSearch)
   │   │   ├─→ Semantic Search
   │   │   └─→ Metadata Filtering
   │   └─→ Return Relevant Firms
   │
   ├─→ Action Group: SearchFirms
   │   └─→ Lambda Function
   │       └─→ Database Query
   │
   ├─→ Action Group: GetFirmDetails
   │   └─→ Lambda Function
   │       └─→ Fetch Complete Profiles
   │
   └─→ Claude Synthesis
       ├─→ Rank Results
       ├─→ Generate Explanations
       └─→ Format Response
   ↓
5. Return Structured Response
```

## Component Interactions

### BedrockAgentService Responsibilities

1. **Request Handling**
   - Accept StudentPreferences
   - Validate input
   - Build natural language query

2. **AI Invocation**
   - Agent mode: Use InvokeAgentRequest
   - Direct mode: Use InvokeModelRequest
   - Handle streaming responses
   - Manage sessions

3. **Response Processing**
   - Parse AI output
   - Structure match results
   - Calculate metadata
   - Handle errors

### Controller Responsibilities

1. **HTTP Layer**
   - Accept REST requests
   - Validate JSON payloads
   - Return appropriate status codes

2. **API Documentation**
   - OpenAPI/Swagger annotations
   - Request/response examples

3. **Error Handling**
   - Catch service exceptions
   - Return user-friendly errors
   - Log appropriately

## Configuration Management

### Environment-Based Configuration

**Local Development** (`application.properties`)
- Local database connection
- AWS credentials from environment
- Debug logging enabled
- Bedrock agent optional

**Production** (future `application-prod.properties`)
- Prod database connection
- IAM role credentials
- Info-level logging
- Bedrock agent required
- Caching enabled

### AWS Configuration

**Credentials Resolution Order:**
1. Environment variables (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY)
2. AWS credentials file (~/.aws/credentials)
3. IAM instance profile (in AWS environment)
4. ECS task role (in ECS environment)

**Region Configuration:**
- Configurable via `aws.region` property
- Defaults to us-east-1
- Should match Bedrock agent region

## Security Considerations

### Current POC Security

- AWS credentials via environment/profiles
- No authentication on API endpoints
- Internal use only

### Production Security Requirements

1. **API Authentication**
   - JWT tokens
   - OAuth 2.0
   - API key management

2. **AWS Security**
   - IAM roles (not long-term credentials)
   - Least privilege permissions
   - Bedrock access only

3. **Data Protection**
   - No PII in logs
   - Encrypted connections
   - Secure credential storage

## Performance Considerations

### Current Performance

- **Response Time**: 2-5 seconds (Claude invocation)
- **Throughput**: Limited by Bedrock rate limits
- **Scalability**: Stateless, can scale horizontally

### Optimization Strategies

1. **Caching**
   - Cache common queries (Redis/Caffeine)
   - TTL: 1 hour for match results
   - Invalidate on firm data updates

2. **Async Processing**
   - Non-blocking Bedrock calls
   - Parallel action group invocations
   - WebSocket for streaming results

3. **Batching**
   - Batch embeddings generation
   - Batch database queries
   - Reduce API call overhead

## Error Handling Strategy

### Error Categories

1. **Client Errors (4xx)**
   - Invalid preferences
   - Malformed JSON
   - Missing required fields

2. **Server Errors (5xx)**
   - Bedrock API failures
   - Database connection issues
   - Unexpected exceptions

3. **AWS Errors**
   - Throttling (429)
   - Authentication failures (403)
   - Service unavailable (503)

### Recovery Strategies

- **Retry Logic**: Exponential backoff for throttling
- **Fallback**: Direct Claude invocation if agent fails
- **Circuit Breaker**: Stop calling failing services
- **Graceful Degradation**: Return partial results

## Monitoring and Observability

### Key Metrics

1. **Performance Metrics**
   - Response time (p50, p95, p99)
   - Bedrock API latency
   - Database query time
   - Cache hit rate

2. **Business Metrics**
   - Match requests per hour
   - Average match quality score
   - User satisfaction ratings
   - Cost per query

3. **Error Metrics**
   - Error rate by type
   - Failed Bedrock calls
   - Timeout rate

### Logging Strategy

- **Structured Logging**: JSON format for parsing
- **Correlation IDs**: Track requests end-to-end
- **Sensitive Data**: Redact PII from logs
- **Log Levels**: INFO for prod, DEBUG for dev

## Future Architecture Enhancements

### Phase 1: Database Integration
- Connect to FloRecruit MySQL database
- Extract firm profile data
- Transform to JSON documents
- Store in staging area

### Phase 2: Vector Database
- Set up OpenSearch Serverless
- Generate embeddings (Titan/Cohere)
- Index firm profiles
- Implement semantic search

### Phase 3: Bedrock Agent
- Create production agent
- Implement action groups
- Deploy Lambda functions
- Link knowledge base

### Phase 4: Production Hardening
- Add authentication
- Implement rate limiting
- Set up monitoring
- Deploy to AWS ECS
- Configure auto-scaling

## Technology Decisions

### Why AWS Bedrock?

- **Managed Service**: No ML infrastructure to maintain
- **Enterprise Ready**: SLA, security, compliance
- **Claude Access**: Best-in-class reasoning
- **RAG Support**: Built-in knowledge bases
- **Cost Effective**: Pay per use

### Why Spring Boot?

- **Team Familiarity**: Existing expertise
- **Enterprise Features**: Security, monitoring, etc.
- **Ecosystem**: Rich library ecosystem
- **Integration**: Easy AWS SDK integration
- **Production Ready**: Battle-tested patterns

### Why Java 21?

- **Performance**: Modern JVM improvements
- **Features**: Records, pattern matching, text blocks
- **LTS**: Long-term support (until 2029)
- **Compatibility**: Works with existing stack

## References

- [Main Analysis Document](/Users/nickwhite/obsidian/Analysis/RAG-Based Firm Matching Feature.md)
- [AWS Bedrock Architecture](https://docs.aws.amazon.com/bedrock/latest/userguide/agents-how.html)
- [Spring Boot Best Practices](https://docs.spring.io/spring-boot/reference/)
