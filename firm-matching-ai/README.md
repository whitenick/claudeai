# RAG-Based Firm Matching POC

A proof-of-concept Spring Boot service that uses AWS Bedrock with Claude AI to match law students with appropriate law firms using Retrieval-Augmented Generation (RAG).

## Overview

This POC demonstrates an AI-powered firm matching system that:
- Accepts student preferences (practice areas, location, firm size, culture, etc.)
- Uses AWS Bedrock Agent with Claude AI for intelligent matching
- Leverages RAG to search firm profile data
- Returns ranked firm recommendations with explanations

## Key Features

- ✅ **AWS Bedrock Integration**: Uses Claude via AWS Bedrock for AI-powered matching
- ✅ **RAG Architecture**: Supports vector search over firm profiles (when configured)
- ✅ **Fallback Mode**: Direct Claude invocation when agent is not configured
- ✅ **Structured Preferences**: Type-safe student preference model
- ✅ **RESTful API**: Clean REST endpoints with OpenAPI documentation
- ✅ **Spring Boot 3**: Modern Java 21 with Spring Boot 3.3.5

## Technology Stack

- **Java 21 LTS** - Latest long-term support version
- **Spring Boot 3.3.5** - Latest Spring Boot framework
- **AWS Bedrock** - Claude AI via AWS managed service
- **AWS Bedrock Agents** - RAG orchestration layer
- **Gradle 8+** - Build system
- **Lombok** - Reduce boilerplate code
- **OpenAPI/Swagger** - API documentation

## Project Structure

```
firm-matching-ai/
├── src/
│   ├── main/
│   │   ├── java/com/flo/firm_matching/
│   │   │   ├── FirmMatchingApplication.java    # Main application
│   │   │   ├── aws/
│   │   │   │   └── BedrockAgentService.java    # AWS Bedrock integration
│   │   │   ├── config/
│   │   │   │   └── AwsBedrockConfig.java       # AWS configuration
│   │   │   ├── controller/
│   │   │   │   └── FirmMatchingController.java # REST API
│   │   │   ├── domain/
│   │   │   │   ├── StudentPreferences.java     # Student preferences model
│   │   │   │   └── FirmMatchResponse.java      # Match response model
│   │   │   ├── service/
│   │   │   └── repository/
│   │   └── resources/
│   │       ├── application.properties          # Configuration
│   │       └── db/migration/                   # Database migrations
│   └── test/
├── build.gradle                                # Gradle build configuration
└── README.md
```

## Quick Start

### Prerequisites

- **Java 21** installed (use SDKMAN: `sdk install java 21.0.7-amzn`)
- **AWS Account** with Bedrock access
- **AWS CLI** configured with credentials
- **PostgreSQL** (optional, for firm data extraction)

### Installation

1. **Clone and navigate to the project:**
   ```bash
   cd /Users/nickwhite/Development/Github/whitenick/claudeai/firm-matching-ai
   ```

2. **Configure AWS credentials:**
   ```bash
   aws configure
   # Or set environment variables:
   export AWS_ACCESS_KEY_ID=your_key
   export AWS_SECRET_ACCESS_KEY=your_secret
   export AWS_REGION=us-east-1
   ```

3. **Configure Bedrock Agent (optional):**
   ```bash
   # If you have a Bedrock agent set up:
   export AWS_BEDROCK_AGENT_ID=your-agent-id
   export AWS_BEDROCK_AGENT_ALIAS_ID=your-alias-id
   ```

4. **Build the project:**
   ```bash
   ./gradlew clean build
   ```

5. **Run the service:**
   ```bash
   ./gradlew bootRun
   ```

   The service will start on http://localhost:8084

### Running Tests

```bash
./gradlew test
```

## API Usage

### Health Check

```bash
curl http://localhost:8084/api/v1/firm-matching/health
```

### Match Firms

```bash
curl -X POST http://localhost:8084/api/v1/firm-matching/match \
  -H "Content-Type: application/json" \
  -d '{
    "studentId": "123e4567-e89b-12d3-a456-426614174000",
    "practiceAreas": [
      {
        "area": "Corporate Law",
        "priority": "HIGH"
      },
      {
        "area": "Intellectual Property",
        "priority": "MEDIUM"
      }
    ],
    "geography": {
      "preferredCities": ["New York", "San Francisco"],
      "willingToRelocate": true,
      "regionalPreference": "East Coast"
    },
    "firmSize": {
      "preference": "LARGE",
      "minAttorneys": 100
    },
    "workArrangement": {
      "remoteFlexibility": "HYBRID_PREFERRED",
      "maxDaysInOffice": 3
    },
    "culture": {
      "priorities": [
        "work-life balance",
        "diversity and inclusion",
        "pro bono opportunities"
      ]
    },
    "queryContext": {
      "searchType": "SUMMER_ASSOCIATE",
      "explicitQuery": "I want large corporate firms in NYC with strong work-life balance"
    }
  }'
```

### API Documentation

- **Swagger UI**: http://localhost:8084/swagger-ui.html
- **OpenAPI Spec**: http://localhost:8084/api-docs

## Configuration

Key configuration properties in `application.properties`:

```properties
# AWS Bedrock
aws.region=us-east-1
aws.bedrock.agent.id=${AWS_BEDROCK_AGENT_ID:}
aws.bedrock.agent.alias-id=${AWS_BEDROCK_AGENT_ALIAS_ID:TSTALIASID}
aws.bedrock.model-id=anthropic.claude-3-5-sonnet-20241022-v2:0
aws.bedrock.max-tokens=4096
aws.bedrock.temperature=0.1

# Server
server.port=8084
```

## Architecture

### High-Level Flow

```
Student Preferences (JSON)
    ↓
Spring Boot REST API
    ↓
BedrockAgentService
    ↓
AWS Bedrock Agent (Claude)
    ├─→ Knowledge Base (RAG retrieval) [Optional]
    ├─→ Action Groups (Search/Filter)  [Optional]
    └─→ Direct Claude Invocation       [Fallback]
    ↓
FirmMatchResponse (JSON)
```

### Operating Modes

1. **Agent Mode** (Full RAG):
   - Requires configured Bedrock Agent
   - Uses vector database for semantic search
   - Implements action groups for filtering
   - Best for production use

2. **Direct Mode** (POC Fallback):
   - No agent configuration needed
   - Direct Claude API invocation
   - Good for testing and development
   - Currently active mode in this POC

## AWS Bedrock Setup

### Required IAM Permissions

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "bedrock:InvokeModel",
        "bedrock:InvokeAgent",
        "bedrock:ListFoundationModels"
      ],
      "Resource": "*"
    }
  ]
}
```

### Creating a Bedrock Agent

1. **Navigate to AWS Bedrock Console** → Agents
2. **Create Agent** with:
   - Name: `firm-matching-agent`
   - Model: Claude 3.5 Sonnet
   - Instructions: Use the prompt from the analysis document
3. **Create Knowledge Base** (optional for full RAG):
   - Connect to OpenSearch or pgvector
   - Upload firm profile documents
4. **Create Action Groups** (optional):
   - SearchFirms
   - GetFirmDetails
   - FilterByMetadata
5. **Deploy Agent** and note the Agent ID and Alias ID

## Development

### Adding New Features

1. **Domain Models**: Add to `domain/` package
2. **Services**: Business logic in `service/` package
3. **Controllers**: REST endpoints in `controller/` package
4. **AWS Integration**: Bedrock-specific code in `aws/` package

### Code Style

- Use Java 21 features (records, pattern matching, text blocks)
- Follow Spring Boot conventions
- Use Lombok to reduce boilerplate
- Document public APIs with JavaDoc and Swagger annotations

## Next Steps

### Phase 1: Complete POC (Current)
- [x] Spring Boot project setup
- [x] AWS Bedrock integration
- [x] Basic REST API
- [x] Student preferences model
- [ ] Add database connection for firm data
- [ ] Implement firm profile extraction
- [ ] Test with sample data

### Phase 2: RAG Implementation
- [ ] Set up vector database (OpenSearch or pgvector)
- [ ] Implement data extraction pipeline
- [ ] Create embeddings for firm profiles
- [ ] Configure Bedrock Knowledge Base
- [ ] Test semantic search quality

### Phase 3: Agent Enhancement
- [ ] Create Bedrock Agent
- [ ] Implement action groups
- [ ] Add filtering and ranking logic
- [ ] Optimize prompts
- [ ] A/B test different retrieval strategies

### Phase 4: Production Readiness
- [ ] Add authentication/authorization
- [ ] Implement caching layer
- [ ] Add monitoring and metrics
- [ ] Performance optimization
- [ ] Cost optimization
- [ ] Integration tests
- [ ] Load testing

## Cost Estimation

**Current POC Mode (Direct Claude invocation):**
- ~$0.003 per query (Claude Sonnet 3.5)
- Estimated: $3-5/month for development testing

**Full Production Mode (with RAG):**
- See analysis document for detailed breakdown
- Estimated: ~$875/month
  - Claude API: ~$165/month
  - OpenSearch: ~$700/month
  - Embeddings: ~$1/month

## Troubleshooting

### AWS Bedrock connectivity fails
- Verify AWS credentials: `aws sts get-caller-identity`
- Check IAM permissions include Bedrock access
- Ensure correct AWS region is set
- Verify Claude model access is enabled in Bedrock console

### Service won't start
- Check Java 21 is installed: `java -version`
- Verify all dependencies downloaded: `./gradlew dependencies`
- Check logs for specific errors

### API returns empty results
- This is expected in POC mode without firm database
- Configure database connection to enable firm data retrieval
- Or set up Bedrock Agent for full RAG functionality

## Related Documentation

- [Analysis Document](/Users/nickwhite/obsidian/Analysis/RAG-Based Firm Matching Feature.md)
- [AWS Bedrock Documentation](https://docs.aws.amazon.com/bedrock/)
- [Claude API Documentation](https://docs.anthropic.com/claude/docs/)
- [Spring Boot Documentation](https://docs.spring.io/spring-boot/)

## Contributing

This is a POC for architectural validation. Focus areas:

1. **AWS Bedrock Integration** - Ensure reliable agent invocation
2. **Prompt Engineering** - Optimize for better match quality
3. **Performance** - Measure and optimize response times
4. **Cost Management** - Track and optimize AWS costs

## License

Proprietary - FloRecruit Internal Use Only

---

**Status**: POC Phase - Ready for testing and iteration
**Next Milestone**: Connect to firm database and implement data extraction
