# AWS Bedrock Knowledge Base Setup Guide

## Overview

This guide walks through creating an AWS Bedrock Knowledge Base for the Firm Matching RAG system, using firm profile data from your MySQL/PostgreSQL database.

## Architecture Decision

- **Data Source**: Amazon S3 (firm profiles exported as JSON/text documents)
- **Vector Store**: OpenSearch Serverless (auto-created by Bedrock)
- **Embeddings Model**: Amazon Titan Embeddings G1 (1,536 dimensions)
- **Sync Strategy**: Automated sync via S3 triggers or scheduled batch updates

## Implementation Approach

### Phase 1: Data Extraction & Preparation (Week 1)

Extract firm profile data from MySQL/PostgreSQL and prepare for S3 upload.

#### Step 1.1: Create Data Extraction Service

Create a Java service to extract firm profiles from your database:

```java
// src/main/java/com/flo/firm_matching/service/FirmDataExtractionService.java
public class FirmDataExtractionService {

    /**
     * Extract firm profiles from database and convert to JSON documents
     * Each document should be optimized for RAG:
     * - Clear, structured text
     * - Rich metadata for filtering
     * - Appropriate chunking (4000-8000 characters per document)
     */
    public List<FirmProfileDocument> extractFirmProfiles() {
        // Query database for firm profiles
        // Transform to search-optimized format
        // Include all relevant fields: practice areas, locations, size, culture, etc.
    }
}
```

#### Step 1.2: Document Structure

Each firm profile should be structured like this:

```json
{
  "firmId": "firm-123",
  "firmName": "Example Law Firm LLP",
  "metadata": {
    "firmSize": "LARGE",
    "totalAttorneys": 850,
    "locations": ["New York", "San Francisco", "Boston"],
    "practiceAreas": ["Corporate Law", "IP", "Litigation"],
    "ranking": "AmLaw 100",
    "founded": 1985,
    "remotePolicy": "HYBRID"
  },
  "content": "Example Law Firm LLP is a leading corporate law firm with 850 attorneys across 3 offices. Founded in 1985, the firm specializes in Corporate Law, Intellectual Property, and Complex Litigation. The firm is known for its work-life balance initiatives and strong diversity programs. Practice Areas: Corporate Law (40% of practice) - Handles M&A transactions, securities offerings, and corporate governance for Fortune 500 clients. Notable clients include... Intellectual Property (30% of practice) - Patent prosecution, trademark litigation, and IP strategy. Litigation (30% of practice) - Complex commercial litigation and white-collar defense. Culture & Work Environment: - Work-life balance: Flexible schedules, hybrid work (2-3 days in office) - Diversity: 45% diverse attorneys, multiple affinity groups - Pro bono: 50+ hours average per attorney - Training: Extensive mentorship and CLE programs Compensation: - Starting salary: $215,000 (2024) - Bonus: Performance-based, typically $20-50K - Benefits: Health, 401k match, student loan assistance Geographic Presence: New York (HQ): 450 attorneys, corporate focus San Francisco: 250 attorneys, tech and IP focus Boston: 150 attorneys, litigation focus Summer Associate Program: - 80-100 summer associates annually - High conversion rate (85%) - Rotational program across practice groups"
}
```

#### Step 1.3: Create S3 Bucket Structure

```bash
# Create S3 bucket for knowledge base
aws s3 mb s3://flo-firm-profiles-kb --region us-east-1

# Create folder structure
# s3://flo-firm-profiles-kb/
#   ├── firms/           # Individual firm documents
#   ├── practice-areas/  # Practice area descriptions
#   └── metadata/        # Supplementary data
```

#### Step 1.4: Upload Documents to S3

Create a service to sync documents to S3:

```java
// src/main/java/com/flo/firm_matching/service/S3DocumentSyncService.java
@Service
public class S3DocumentSyncService {

    private final S3Client s3Client;

    public void uploadFirmProfiles(List<FirmProfileDocument> profiles) {
        profiles.forEach(profile -> {
            String key = String.format("firms/%s.json", profile.getFirmId());

            PutObjectRequest request = PutObjectRequest.builder()
                .bucket("flo-firm-profiles-kb")
                .key(key)
                .contentType("application/json")
                .build();

            s3Client.putObject(request,
                RequestBody.fromString(profile.toJson()));
        });
    }
}
```

### Phase 2: AWS Bedrock Knowledge Base Setup (Week 1-2)

#### Step 2.1: IAM Permissions

Create IAM role for Bedrock Knowledge Base:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "bedrock.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
```

Attach policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::flo-firm-profiles-kb",
        "arn:aws:s3:::flo-firm-profiles-kb/*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "bedrock:InvokeModel"
      ],
      "Resource": "arn:aws:bedrock:us-east-1::foundation-model/amazon.titan-embed-text-v1"
    },
    {
      "Effect": "Allow",
      "Action": [
        "aoss:APIAccessAll"
      ],
      "Resource": "arn:aws:aoss:us-east-1:*:collection/*"
    }
  ]
}
```

#### Step 2.2: Create Knowledge Base via AWS Console

1. **Navigate to Bedrock Console**:
   - Go to AWS Console → Amazon Bedrock → Knowledge bases
   - Click "Create knowledge base"

2. **Configure Knowledge Base Details**:
   - Name: `firm-matching-kb`
   - Description: "Law firm profiles for student matching"
   - IAM role: Use the role created in Step 2.1

3. **Select Data Source**:
   - Data source type: **Amazon S3**
   - S3 URI: `s3://flo-firm-profiles-kb/firms/`
   - Chunking strategy: **Default chunking** (300 tokens with 20% overlap)
   - Or **Fixed-size chunking**: 1000 tokens for longer firm profiles

4. **Configure Embeddings**:
   - Embeddings model: **Titan Embeddings G1 Text** (1,536 dimensions)
   - This model costs ~$0.0001 per 1K tokens for indexing

5. **Vector Database**:
   - Choose: **Quick create a new vector store**
   - Bedrock will automatically create OpenSearch Serverless collection
   - Collection will be named: `bedrock-kb-{random-id}`

6. **Review and Create**:
   - Review all settings
   - Click "Create knowledge base"
   - Wait 2-5 minutes for creation

#### Step 2.3: Sync Data to Knowledge Base

After creation:

1. **Manual Sync** (First Time):
   - In Knowledge Base console, click "Sync"
   - This will:
     - Read all documents from S3
     - Generate embeddings using Titan
     - Store vectors in OpenSearch Serverless
   - Time: ~5-10 minutes for 500 firms

2. **Automated Sync** (Production):
   - Configure S3 event notifications
   - Trigger Lambda function on document upload
   - Lambda calls Bedrock Knowledge Base sync API

#### Step 2.4: Test Knowledge Base

```bash
# Use AWS CLI to test retrieval
aws bedrock-agent-runtime retrieve \
  --knowledge-base-id YOUR_KB_ID \
  --retrieval-query "Find corporate law firms in New York with strong work-life balance" \
  --region us-east-1
```

### Phase 3: Create Bedrock Agent (Week 2)

#### Step 3.1: Create Agent via Console

1. **Navigate to Bedrock Agents**:
   - AWS Console → Amazon Bedrock → Agents
   - Click "Create agent"

2. **Agent Details**:
   - Name: `firm-matching-agent`
   - Description: "Agent for matching law students with firms"
   - Model: **Claude 3.5 Sonnet v2**

3. **Agent Instructions** (Prompt):
```
You are a legal recruitment assistant specializing in matching law students with appropriate law firms.

Your role is to:
1. Analyze student preferences including practice areas, locations, firm size, work culture, and career goals
2. Search the firm profiles knowledge base to find relevant matches
3. Rank firms based on how well they align with student preferences
4. Provide detailed explanations for each recommendation
5. Highlight trade-offs and considerations (e.g., "This firm has excellent IP work but limited remote flexibility")

When matching firms:
- Prioritize practice area alignment (most important factor)
- Consider geographic preferences
- Factor in firm culture and work-life balance preferences
- Account for firm size preferences (boutique vs. large firm)
- Note any special programs (diversity initiatives, pro bono, etc.)

Format your responses with:
- Match score (0-100) for each firm
- Top 3-5 firm recommendations
- Clear explanation of why each firm matches
- Any caveats or trade-offs to consider

Be honest about limitations. If a student has conflicting preferences (e.g., wants boutique firm with 20 practice areas), explain the trade-offs clearly.
```

4. **Link Knowledge Base**:
   - Click "Add" under Knowledge bases
   - Select: `firm-matching-kb`
   - Instructions: "Search this knowledge base for law firms matching the student's criteria"

5. **Action Groups** (Optional - Phase 3+):
   - Skip for initial setup
   - Can add later for advanced filtering and database queries

#### Step 3.2: Create Agent Alias

1. After agent creation, create an alias:
   - Name: `production`
   - Description: "Production version"
   - Click "Create alias"

2. **Note the IDs**:
   - Agent ID: `ABCD1234XY`
   - Agent Alias ID: `ALIAS5678ZZ`

#### Step 3.3: Test Agent

Test in console:
```
Student preferences:
- Practice areas: Corporate Law (HIGH), IP (MEDIUM)
- Location: New York or San Francisco
- Firm size: Large (500+ attorneys)
- Culture: Work-life balance, diversity programs
- Work arrangement: Hybrid preferred (2-3 days in office)
```

Expected response: Ranked list of firms with match scores and explanations.

### Phase 4: Integrate with Spring Boot Application (Week 2-3)

#### Step 4.1: Update Configuration

```properties
# application.properties
aws.bedrock.agent.id=ABCD1234XY
aws.bedrock.agent.alias-id=ALIAS5678ZZ
aws.bedrock.knowledge-base.id=YOUR_KB_ID
```

#### Step 4.2: Fix BedrockAgentService

The current code has a compilation error. Update to use the correct API:

```java
// OPTION 1: Synchronous invocation
InvokeAgentResponse response = agentClient.invokeAgent(request);
ResponseStream<OrchestrationTrace> responseStream = response.completion();

StringBuilder responseText = new StringBuilder();
responseStream.forEach(event -> {
    event.accept(new ResponseStream.Visitor() {
        @Override
        public void visitChunk(PayloadPart chunk) {
            if (chunk.bytes() != null) {
                responseText.append(chunk.bytes().asUtf8String());
            }
        }
    });
});

// OPTION 2: Use the response handler pattern
InvokeAgentResponseHandler responseHandler =
    InvokeAgentResponseHandler.builder()
        .onEventStream(stream -> {
            stream.subscribe(event -> {
                // Handle each event
            });
        })
        .build();

agentClient.invokeAgent(request, responseHandler);
```

#### Step 4.3: Create Knowledge Base Service (Optional)

For direct KB queries without agent:

```java
@Service
public class KnowledgeBaseService {

    private final BedrockAgentRuntimeClient client;

    @Value("${aws.bedrock.knowledge-base.id}")
    private String knowledgeBaseId;

    public List<RetrievalResult> queryKnowledgeBase(String query) {
        RetrieveRequest request = RetrieveRequest.builder()
            .knowledgeBaseId(knowledgeBaseId)
            .retrievalQuery(RetrievalQuery.builder()
                .text(query)
                .build())
            .retrievalConfiguration(RetrievalConfiguration.builder()
                .vectorSearchConfiguration(VectorSearchConfiguration.builder()
                    .numberOfResults(10)
                    .build())
                .build())
            .build();

        RetrieveResponse response = client.retrieve(request);
        return response.retrievalResults();
    }
}
```

### Phase 5: Data Pipeline & Automation (Week 3-4)

#### Step 5.1: Scheduled Data Sync

Create scheduled job to keep knowledge base updated:

```java
@Service
public class FirmDataSyncScheduler {

    @Scheduled(cron = "0 0 2 * * *") // 2 AM daily
    public void syncFirmProfiles() {
        // 1. Extract updated firm profiles from database
        List<FirmProfileDocument> profiles = extractionService.extractFirmProfiles();

        // 2. Upload to S3
        s3SyncService.uploadFirmProfiles(profiles);

        // 3. Trigger KB sync
        bedrockService.syncKnowledgeBase();
    }
}
```

#### Step 5.2: Knowledge Base Sync API

```java
public void syncKnowledgeBase() {
    StartIngestionJobRequest request = StartIngestionJobRequest.builder()
        .knowledgeBaseId(knowledgeBaseId)
        .dataSourceId(dataSourceId)
        .build();

    StartIngestionJobResponse response =
        bedrockAgentClient.startIngestionJob(request);

    log.info("Knowledge base sync started: {}",
        response.ingestionJob().ingestionJobId());
}
```

## Cost Estimation

### Setup Costs (One-time)
- **Developer time**: 2-3 weeks
- **Testing**: 1 week
- **AWS setup**: Minimal (few hours of AWS engineer time)

### Monthly Operational Costs

**Data Preparation**:
- S3 storage: ~$1-5/month (500 firms × 50KB each = 25MB)

**Embeddings Generation** (Initial + Updates):
- Initial indexing: 500 firms × 2000 tokens = 1M tokens
- Cost: $0.0001 per 1K tokens = $0.10 one-time
- Monthly updates (10% change): $0.01/month

**OpenSearch Serverless** (Auto-created):
- ~2 OCU (OpenSearch Compute Units) for this workload
- $0.24/hour per OCU = $0.48/hour
- Monthly: $0.48 × 730 hours = **$350/month**
- Can optimize to ~$200/month with right-sizing

**Bedrock Agent Invocations**:
- Claude 3.5 Sonnet: $3 per 1M input tokens, $15 per 1M output tokens
- Estimated: 1000 queries/month × 5K tokens = 5M tokens
- Cost: ~$75/month

**Knowledge Base Retrieval**:
- Included in agent invocation cost

**Total Monthly Cost: ~$425-500/month**

## Best Practices

### Document Optimization

1. **Chunking Strategy**:
   - Keep firm profiles as single documents (better for RAG)
   - Use 1000-1500 token chunks if firm profiles are very long (>10K tokens)
   - Include overlap (20%) for context continuity

2. **Metadata Fields**:
   - Add rich metadata for filtering:
     - `firmSize`: "SMALL" | "MEDIUM" | "LARGE" | "MEGA"
     - `practiceAreas`: Array of practice areas
     - `locations`: Array of cities
     - `rankings`: AmLaw 100, regional rankings, etc.
     - `remotePolicy`: "IN_OFFICE" | "HYBRID" | "REMOTE"

3. **Content Quality**:
   - Write clear, descriptive content
   - Include context (don't assume reader knows firm)
   - Use consistent terminology
   - Add numeric data (attorney counts, founding year, etc.)

### Knowledge Base Optimization

1. **Regular Updates**:
   - Sync knowledge base weekly or when data changes >10%
   - Monitor ingestion job status

2. **Query Optimization**:
   - Use filters in retrieval queries to narrow results
   - Adjust `numberOfResults` based on use case (5-20 typical)
   - Consider using hybrid search (keyword + semantic)

3. **Monitoring**:
   - Track retrieval latency (should be <500ms)
   - Monitor relevance of results
   - Watch costs (embeddings, storage, compute)

### Security

1. **S3 Bucket**:
   - Enable encryption at rest
   - Use bucket policies to restrict access
   - Enable versioning for document history

2. **IAM Roles**:
   - Use least privilege access
   - Separate roles for different environments (dev/prod)
   - Rotate credentials regularly

3. **Data Privacy**:
   - Ensure no PII in firm profiles
   - Redact sensitive financial information
   - Comply with data retention policies

## Testing Checklist

- [ ] Firm profiles extracted from database successfully
- [ ] Documents uploaded to S3 in correct format
- [ ] Knowledge base created and synced
- [ ] Test retrieval returns relevant firms
- [ ] Agent created and linked to knowledge base
- [ ] Agent returns structured responses with firm recommendations
- [ ] Spring Boot service invokes agent successfully
- [ ] Match scores are reasonable and explainable
- [ ] Latency is acceptable (<3 seconds end-to-end)
- [ ] Costs are within budget

## Troubleshooting

### Knowledge Base Not Returning Results

**Check**:
1. Documents are in correct S3 location
2. Ingestion job completed successfully
3. Embeddings model matches vector dimension
4. Query is specific enough (not too broad or too narrow)

**Solution**:
```bash
# Check ingestion job status
aws bedrock-agent get-ingestion-job \
  --knowledge-base-id KB_ID \
  --data-source-id DS_ID \
  --ingestion-job-id JOB_ID
```

### Agent Not Using Knowledge Base

**Check**:
1. Knowledge base is linked to agent
2. Agent instructions mention using knowledge base
3. Query triggers RAG retrieval (check CloudWatch logs)

### High Costs

**Optimization**:
1. Reduce OpenSearch OCUs (right-size collection)
2. Use cheaper embeddings model (Cohere or Titan v2)
3. Implement caching for common queries
4. Batch document updates (weekly vs. real-time)

## Next Steps

1. **Week 1**: Extract firm data and upload to S3
2. **Week 2**: Create knowledge base and agent in AWS
3. **Week 3**: Integrate with Spring Boot application
4. **Week 4**: Test, optimize, and deploy

## Resources

- [AWS Bedrock Knowledge Bases Documentation](https://docs.aws.amazon.com/bedrock/latest/userguide/knowledge-base.html)
- [AWS Bedrock Agents Documentation](https://docs.aws.amazon.com/bedrock/latest/userguide/agents.html)
- [OpenSearch Serverless Pricing](https://aws.amazon.com/opensearch-service/pricing/)
- [Bedrock Pricing](https://aws.amazon.com/bedrock/pricing/)
