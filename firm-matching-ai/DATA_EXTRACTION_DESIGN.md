# Firm Data Extraction Service Design

## Overview

This document describes the automated process for extracting firm profile data from the PostgreSQL database and generating JSON documents optimized for AWS Bedrock RAG Knowledge Base.

## Architecture

### Location in Codebase

The data extraction process lives **inside the firm-matching-ai Spring Boot application** with the following structure:

```
src/main/java/com/flo/firm_matching/
├── entity/                          # JPA entities (database tables)
│   ├── Firm.java
│   ├── FirmLocation.java
│   ├── FirmPracticeArea.java
│   └── FirmCulture.java
│
├── repository/                      # Spring Data JPA repositories
│   ├── FirmRepository.java
│   ├── FirmLocationRepository.java
│   └── FirmPracticeAreaRepository.java
│
├── extraction/                      # NEW: Data extraction package
│   ├── model/
│   │   ├── FirmProfileDocument.java      # Output model for KB
│   │   └── FirmProfileMetadata.java      # Metadata structure
│   │
│   ├── service/
│   │   ├── FirmExtractionService.java    # Core extraction logic
│   │   ├── S3SyncService.java            # Upload to S3
│   │   └── KnowledgeBaseSyncService.java # Trigger KB sync
│   │
│   ├── transformer/
│   │   └── FirmToDocumentTransformer.java # Entity → JSON transform
│   │
│   └── scheduler/
│       └── DataExtractionScheduler.java  # Automated sync jobs
│
└── controller/
    └── DataExtractionController.java     # REST API for manual triggers
```

## Database Schema

### Assumed Schema Structure

Based on typical law firm databases, here's the assumed structure:

```sql
-- Main firm table
CREATE TABLE firms (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    firm_size VARCHAR(50), -- SMALL, MEDIUM, LARGE, MEGA
    total_attorneys INTEGER,
    founded_year INTEGER,
    website_url VARCHAR(500),
    ranking VARCHAR(100),
    remote_policy VARCHAR(50), -- IN_OFFICE, HYBRID, REMOTE
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Firm locations (many-to-many)
CREATE TABLE firm_locations (
    id BIGSERIAL PRIMARY KEY,
    firm_id BIGINT REFERENCES firms(id),
    city VARCHAR(100) NOT NULL,
    state VARCHAR(50),
    country VARCHAR(50) DEFAULT 'USA',
    is_headquarters BOOLEAN DEFAULT FALSE,
    attorney_count INTEGER,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Practice areas (many-to-many)
CREATE TABLE firm_practice_areas (
    id BIGSERIAL PRIMARY KEY,
    firm_id BIGINT REFERENCES firms(id),
    practice_area VARCHAR(100) NOT NULL,
    percentage_of_practice DECIMAL(5,2),
    description TEXT,
    notable_clients TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Culture & benefits
CREATE TABLE firm_culture (
    id BIGSERIAL PRIMARY KEY,
    firm_id BIGINT REFERENCES firms(id) UNIQUE,
    work_life_balance_rating INTEGER, -- 1-5
    diversity_percentage DECIMAL(5,2),
    pro_bono_hours_avg INTEGER,
    training_programs TEXT,
    benefits_summary TEXT,
    culture_description TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Compensation
CREATE TABLE firm_compensation (
    id BIGSERIAL PRIMARY KEY,
    firm_id BIGINT REFERENCES firms(id),
    position_level VARCHAR(50), -- SUMMER_ASSOCIATE, FIRST_YEAR, etc.
    base_salary INTEGER,
    bonus_range_min INTEGER,
    bonus_range_max INTEGER,
    year INTEGER,
    created_at TIMESTAMP DEFAULT NOW()
);
```

## Component Design

### 1. JPA Entities

**Firm.java** - Main entity
```java
@Entity
@Table(name = "firms")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Firm {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(name = "firm_size")
    private FirmSize firmSize;

    @Column(name = "total_attorneys")
    private Integer totalAttorneys;

    @Column(name = "founded_year")
    private Integer foundedYear;

    @Column(name = "website_url", length = 500)
    private String websiteUrl;

    private String ranking;

    @Enumerated(EnumType.STRING)
    @Column(name = "remote_policy")
    private RemotePolicy remotePolicy;

    @OneToMany(mappedBy = "firm", fetch = FetchType.LAZY)
    private List<FirmLocation> locations;

    @OneToMany(mappedBy = "firm", fetch = FetchType.LAZY)
    private List<FirmPracticeArea> practiceAreas;

    @OneToOne(mappedBy = "firm", fetch = FetchType.LAZY)
    private FirmCulture culture;

    @OneToMany(mappedBy = "firm", fetch = FetchType.LAZY)
    private List<FirmCompensation> compensation;

    @Column(name = "created_at")
    private Instant createdAt;

    @Column(name = "updated_at")
    private Instant updatedAt;
}
```

### 2. Extraction Service

**FirmExtractionService.java** - Core logic
```java
@Service
@Slf4j
public class FirmExtractionService {

    private final FirmRepository firmRepository;
    private final FirmToDocumentTransformer transformer;
    private final ObjectMapper objectMapper;

    /**
     * Extract all firm profiles from database
     * @return List of firm profile documents ready for KB
     */
    public List<FirmProfileDocument> extractAllFirms() {
        log.info("Starting firm data extraction");
        long startTime = System.currentTimeMillis();

        List<Firm> firms = firmRepository.findAllWithDetails();

        List<FirmProfileDocument> documents = firms.stream()
            .map(transformer::transform)
            .filter(Objects::nonNull)
            .toList();

        long duration = System.currentTimeMillis() - startTime;
        log.info("Extracted {} firms in {}ms", documents.size(), duration);

        return documents;
    }

    /**
     * Extract only firms updated since last sync
     * @param lastSyncTime Timestamp of last sync
     * @return List of updated firm documents
     */
    public List<FirmProfileDocument> extractUpdatedFirms(Instant lastSyncTime) {
        log.info("Extracting firms updated since {}", lastSyncTime);

        List<Firm> firms = firmRepository.findByUpdatedAtAfter(lastSyncTime);

        return firms.stream()
            .map(transformer::transform)
            .filter(Objects::nonNull)
            .toList();
    }

    /**
     * Extract single firm by ID
     */
    public Optional<FirmProfileDocument> extractFirm(Long firmId) {
        return firmRepository.findByIdWithDetails(firmId)
            .map(transformer::transform);
    }

    /**
     * Get extraction statistics
     */
    public ExtractionStats getStats() {
        long totalFirms = firmRepository.count();
        Instant lastUpdate = firmRepository.findLatestUpdateTime()
            .orElse(Instant.now());

        return new ExtractionStats(totalFirms, lastUpdate);
    }
}
```

### 3. Document Transformer

**FirmToDocumentTransformer.java** - Entity to JSON
```java
@Component
@Slf4j
public class FirmToDocumentTransformer {

    /**
     * Transform database entity into RAG-optimized document
     *
     * Key principles:
     * 1. Rich, descriptive content (2000-4000 tokens)
     * 2. Structured metadata for filtering
     * 3. Natural language optimized for semantic search
     * 4. Include all searchable attributes
     */
    public FirmProfileDocument transform(Firm firm) {
        try {
            return FirmProfileDocument.builder()
                .firmId(firm.getId().toString())
                .firmName(firm.getName())
                .metadata(buildMetadata(firm))
                .content(buildContent(firm))
                .build();
        } catch (Exception e) {
            log.error("Error transforming firm {}", firm.getId(), e);
            return null;
        }
    }

    private FirmProfileMetadata buildMetadata(Firm firm) {
        return FirmProfileMetadata.builder()
            .firmSize(firm.getFirmSize().name())
            .totalAttorneys(firm.getTotalAttorneys())
            .locations(extractLocations(firm.getLocations()))
            .practiceAreas(extractPracticeAreas(firm.getPracticeAreas()))
            .ranking(firm.getRanking())
            .founded(firm.getFoundedYear())
            .remotePolicy(firm.getRemotePolicy().name())
            .build();
    }

    /**
     * Build rich text content for semantic search
     * This is the most important part - must be descriptive and searchable
     */
    private String buildContent(Firm firm) {
        StringBuilder content = new StringBuilder();

        // Firm overview (200-300 tokens)
        content.append(buildOverview(firm));
        content.append("\n\n");

        // Practice areas (500-1000 tokens)
        content.append(buildPracticeAreaSection(firm));
        content.append("\n\n");

        // Culture & work environment (400-600 tokens)
        content.append(buildCultureSection(firm));
        content.append("\n\n");

        // Compensation (200-300 tokens)
        content.append(buildCompensationSection(firm));
        content.append("\n\n");

        // Geographic presence (200-400 tokens)
        content.append(buildLocationSection(firm));
        content.append("\n\n");

        // Summer associate program (if applicable)
        content.append(buildSummerProgramSection(firm));

        return content.toString();
    }

    private String buildOverview(Firm firm) {
        return String.format(
            "%s is a %s law firm with %d attorneys. %s Founded in %d, " +
            "the firm is %s and specializes in %s. The firm operates with a %s work arrangement.",
            firm.getName(),
            firm.getFirmSize().getDisplayName(),
            firm.getTotalAttorneys(),
            firm.getDescription() != null ? firm.getDescription() + " " : "",
            firm.getFoundedYear(),
            firm.getRanking() != null ? "ranked as " + firm.getRanking() : "well-established",
            getPrimaryPracticeAreas(firm),
            firm.getRemotePolicy().getDisplayName()
        );
    }

    private String buildPracticeAreaSection(Firm firm) {
        StringBuilder section = new StringBuilder("Practice Areas:\n");

        firm.getPracticeAreas().forEach(pa -> {
            section.append(String.format(
                "- %s (%d%% of practice): %s",
                pa.getPracticeArea(),
                pa.getPercentageOfPractice().intValue(),
                pa.getDescription() != null ? pa.getDescription() : ""
            ));

            if (pa.getNotableClients() != null) {
                section.append(" Notable clients include: ")
                       .append(pa.getNotableClients());
            }
            section.append("\n");
        });

        return section.toString();
    }

    private String buildCultureSection(Firm firm) {
        FirmCulture culture = firm.getCulture();
        if (culture == null) {
            return "Culture & Work Environment: Information not available.";
        }

        return String.format(
            "Culture & Work Environment:\n" +
            "- Work-life balance rating: %d/5\n" +
            "- Diversity: %d%% diverse attorneys\n" +
            "- Pro bono: Average %d hours per attorney\n" +
            "- Training: %s\n" +
            "- Benefits: %s\n" +
            "- Culture: %s",
            culture.getWorkLifeBalanceRating(),
            culture.getDiversityPercentage().intValue(),
            culture.getProBonoHoursAvg(),
            culture.getTrainingPrograms(),
            culture.getBenefitsSummary(),
            culture.getCultureDescription()
        );
    }

    private String buildCompensationSection(Firm firm) {
        List<FirmCompensation> compensation = firm.getCompensation();
        if (compensation.isEmpty()) {
            return "Compensation: Information not available.";
        }

        StringBuilder section = new StringBuilder("Compensation:\n");

        // Group by position level
        Map<String, FirmCompensation> latest = compensation.stream()
            .collect(Collectors.toMap(
                FirmCompensation::getPositionLevel,
                Function.identity(),
                (c1, c2) -> c1.getYear() > c2.getYear() ? c1 : c2
            ));

        latest.forEach((level, comp) -> {
            section.append(String.format(
                "- %s (%d): $%,d base, bonus $%,d-$%,d\n",
                level,
                comp.getYear(),
                comp.getBaseSalary(),
                comp.getBonusRangeMin(),
                comp.getBonusRangeMax()
            ));
        });

        return section.toString();
    }

    private String buildLocationSection(Firm firm) {
        StringBuilder section = new StringBuilder("Geographic Presence:\n");

        FirmLocation hq = firm.getLocations().stream()
            .filter(FirmLocation::getIsHeadquarters)
            .findFirst()
            .orElse(null);

        if (hq != null) {
            section.append(String.format(
                "%s (HQ): %d attorneys\n",
                hq.getCity(),
                hq.getAttorneyCount()
            ));
        }

        firm.getLocations().stream()
            .filter(loc -> !loc.getIsHeadquarters())
            .forEach(loc -> {
                section.append(String.format(
                    "%s: %d attorneys\n",
                    loc.getCity(),
                    loc.getAttorneyCount()
                ));
            });

        return section.toString();
    }

    private String buildSummerProgramSection(Firm firm) {
        // TODO: Add summer program table/entity if available
        return "Summer Associate Program: Please contact firm for details.";
    }

    private List<String> extractLocations(List<FirmLocation> locations) {
        return locations.stream()
            .map(FirmLocation::getCity)
            .distinct()
            .toList();
    }

    private List<String> extractPracticeAreas(List<FirmPracticeArea> areas) {
        return areas.stream()
            .map(FirmPracticeArea::getPracticeArea)
            .toList();
    }

    private String getPrimaryPracticeAreas(Firm firm) {
        return firm.getPracticeAreas().stream()
            .sorted(Comparator.comparing(FirmPracticeArea::getPercentageOfPractice).reversed())
            .limit(3)
            .map(FirmPracticeArea::getPracticeArea)
            .collect(Collectors.joining(", "));
    }
}
```

### 4. S3 Sync Service

**S3SyncService.java** - Upload to S3
```java
@Service
@Slf4j
public class S3SyncService {

    private final S3Client s3Client;
    private final ObjectMapper objectMapper;

    @Value("${aws.s3.bucket-name}")
    private String bucketName;

    @Value("${aws.s3.prefix:firms/}")
    private String prefix;

    /**
     * Upload firm documents to S3
     * Each document becomes a separate JSON file
     */
    public SyncResult uploadDocuments(List<FirmProfileDocument> documents) {
        log.info("Uploading {} documents to S3 bucket: {}",
            documents.size(), bucketName);

        long startTime = System.currentTimeMillis();
        List<String> uploaded = new ArrayList<>();
        List<String> failed = new ArrayList<>();

        for (FirmProfileDocument doc : documents) {
            try {
                String key = buildS3Key(doc);
                String json = objectMapper.writeValueAsString(doc);

                PutObjectRequest request = PutObjectRequest.builder()
                    .bucket(bucketName)
                    .key(key)
                    .contentType("application/json")
                    .metadata(Map.of(
                        "firmId", doc.getFirmId(),
                        "firmName", doc.getFirmName(),
                        "lastUpdated", Instant.now().toString()
                    ))
                    .build();

                s3Client.putObject(request,
                    RequestBody.fromString(json, StandardCharsets.UTF_8));

                uploaded.add(key);
                log.debug("Uploaded: {}", key);

            } catch (Exception e) {
                log.error("Failed to upload firm {}: {}",
                    doc.getFirmId(), e.getMessage());
                failed.add(doc.getFirmId());
            }
        }

        long duration = System.currentTimeMillis() - startTime;
        log.info("Upload complete: {} success, {} failed in {}ms",
            uploaded.size(), failed.size(), duration);

        return new SyncResult(uploaded, failed, duration);
    }

    /**
     * Delete documents from S3
     */
    public void deleteDocuments(List<String> firmIds) {
        List<ObjectIdentifier> keys = firmIds.stream()
            .map(id -> ObjectIdentifier.builder()
                .key(prefix + id + ".json")
                .build())
            .toList();

        DeleteObjectsRequest request = DeleteObjectsRequest.builder()
            .bucket(bucketName)
            .delete(Delete.builder().objects(keys).build())
            .build();

        s3Client.deleteObjects(request);
        log.info("Deleted {} documents from S3", keys.size());
    }

    private String buildS3Key(FirmProfileDocument doc) {
        return prefix + doc.getFirmId() + ".json";
    }

    /**
     * Check if bucket exists and is accessible
     */
    public boolean validateBucket() {
        try {
            s3Client.headBucket(HeadBucketRequest.builder()
                .bucket(bucketName)
                .build());
            return true;
        } catch (Exception e) {
            log.error("Bucket validation failed: {}", e.getMessage());
            return false;
        }
    }
}
```

### 5. Knowledge Base Sync Service

**KnowledgeBaseSyncService.java** - Trigger Bedrock KB sync
```java
@Service
@Slf4j
public class KnowledgeBaseSyncService {

    private final BedrockAgentClient bedrockAgentClient;

    @Value("${aws.bedrock.knowledge-base.id}")
    private String knowledgeBaseId;

    @Value("${aws.bedrock.knowledge-base.data-source-id}")
    private String dataSourceId;

    /**
     * Trigger knowledge base ingestion job
     * This tells Bedrock to re-scan S3 and update vectors
     */
    public IngestionJobResult startSync() {
        log.info("Starting knowledge base ingestion for KB: {}", knowledgeBaseId);

        StartIngestionJobRequest request = StartIngestionJobRequest.builder()
            .knowledgeBaseId(knowledgeBaseId)
            .dataSourceId(dataSourceId)
            .description("Automated sync from firm-matching-ai service")
            .build();

        try {
            StartIngestionJobResponse response =
                bedrockAgentClient.startIngestionJob(request);

            String jobId = response.ingestionJob().ingestionJobId();
            log.info("Ingestion job started: {}", jobId);

            return new IngestionJobResult(
                jobId,
                response.ingestionJob().status().toString(),
                Instant.now()
            );

        } catch (Exception e) {
            log.error("Failed to start ingestion job", e);
            throw new RuntimeException("Knowledge base sync failed", e);
        }
    }

    /**
     * Check status of ingestion job
     */
    public IngestionJobStatus checkJobStatus(String jobId) {
        GetIngestionJobRequest request = GetIngestionJobRequest.builder()
            .knowledgeBaseId(knowledgeBaseId)
            .dataSourceId(dataSourceId)
            .ingestionJobId(jobId)
            .build();

        GetIngestionJobResponse response =
            bedrockAgentClient.getIngestionJob(request);

        IngestionJob job = response.ingestionJob();

        return IngestionJobStatus.builder()
            .jobId(job.ingestionJobId())
            .status(job.status().toString())
            .startedAt(job.startedAt())
            .updatedAt(job.updatedAt())
            .statistics(job.statistics())
            .build();
    }

    /**
     * Wait for ingestion job to complete (blocking)
     * Use with caution - can take 5-15 minutes
     */
    public IngestionJobStatus waitForCompletion(String jobId, Duration timeout) {
        Instant deadline = Instant.now().plus(timeout);

        while (Instant.now().isBefore(deadline)) {
            IngestionJobStatus status = checkJobStatus(jobId);

            if (status.getStatus().equals("COMPLETE")) {
                log.info("Ingestion job completed: {}", jobId);
                return status;
            }

            if (status.getStatus().equals("FAILED")) {
                throw new RuntimeException("Ingestion job failed: " + jobId);
            }

            try {
                Thread.sleep(30_000); // Check every 30 seconds
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                throw new RuntimeException("Wait interrupted", e);
            }
        }

        throw new RuntimeException("Ingestion job timeout: " + jobId);
    }
}
```

### 6. Scheduled Automation

**DataExtractionScheduler.java** - Automated jobs
```java
@Component
@Slf4j
@ConditionalOnProperty(name = "firm-matching.extraction.scheduler.enabled", havingValue = "true")
public class DataExtractionScheduler {

    private final FirmExtractionService extractionService;
    private final S3SyncService s3SyncService;
    private final KnowledgeBaseSyncService kbSyncService;

    private Instant lastSuccessfulSync = null;

    /**
     * Run daily at 2 AM
     */
    @Scheduled(cron = "${firm-matching.extraction.scheduler.cron:0 0 2 * * *}")
    public void scheduledSync() {
        log.info("Starting scheduled data extraction");

        try {
            // Extract updated firms since last sync
            List<FirmProfileDocument> documents;
            if (lastSuccessfulSync != null) {
                documents = extractionService.extractUpdatedFirms(lastSuccessfulSync);
                log.info("Extracted {} updated firms", documents.size());
            } else {
                // First run - extract all
                documents = extractionService.extractAllFirms();
                log.info("Initial extraction: {} firms", documents.size());
            }

            if (documents.isEmpty()) {
                log.info("No updates to sync");
                return;
            }

            // Upload to S3
            SyncResult s3Result = s3SyncService.uploadDocuments(documents);
            if (!s3Result.getFailed().isEmpty()) {
                log.warn("Some documents failed to upload: {}",
                    s3Result.getFailed().size());
            }

            // Trigger knowledge base sync
            IngestionJobResult kbResult = kbSyncService.startSync();
            log.info("Knowledge base sync triggered: {}", kbResult.getJobId());

            lastSuccessfulSync = Instant.now();

        } catch (Exception e) {
            log.error("Scheduled sync failed", e);
            // Consider: Send alert, metrics, etc.
        }
    }

    /**
     * Run on application startup (if configured)
     */
    @EventListener(ApplicationReadyEvent.class)
    @ConditionalOnProperty(name = "firm-matching.extraction.sync-on-startup", havingValue = "true")
    public void syncOnStartup() {
        log.info("Performing startup data sync");
        scheduledSync();
    }
}
```

### 7. REST API Controller

**DataExtractionController.java** - Manual triggers
```java
@RestController
@RequestMapping("/api/v1/data-extraction")
@Slf4j
public class DataExtractionController {

    private final FirmExtractionService extractionService;
    private final S3SyncService s3SyncService;
    private final KnowledgeBaseSyncService kbSyncService;

    /**
     * Manual trigger: Extract and sync all firms
     */
    @PostMapping("/sync-all")
    public ResponseEntity<SyncResponse> syncAll() {
        log.info("Manual sync-all triggered");

        List<FirmProfileDocument> documents = extractionService.extractAllFirms();
        SyncResult s3Result = s3SyncService.uploadDocuments(documents);
        IngestionJobResult kbResult = kbSyncService.startSync();

        SyncResponse response = SyncResponse.builder()
            .extractedCount(documents.size())
            .uploadedCount(s3Result.getUploaded().size())
            .failedCount(s3Result.getFailed().size())
            .kbJobId(kbResult.getJobId())
            .timestamp(Instant.now())
            .build();

        return ResponseEntity.ok(response);
    }

    /**
     * Extract and sync updated firms since timestamp
     */
    @PostMapping("/sync-since")
    public ResponseEntity<SyncResponse> syncSince(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant since) {

        log.info("Syncing firms updated since: {}", since);

        List<FirmProfileDocument> documents =
            extractionService.extractUpdatedFirms(since);

        if (documents.isEmpty()) {
            return ResponseEntity.ok(SyncResponse.builder()
                .extractedCount(0)
                .message("No updates found")
                .timestamp(Instant.now())
                .build());
        }

        SyncResult s3Result = s3SyncService.uploadDocuments(documents);
        IngestionJobResult kbResult = kbSyncService.startSync();

        SyncResponse response = SyncResponse.builder()
            .extractedCount(documents.size())
            .uploadedCount(s3Result.getUploaded().size())
            .failedCount(s3Result.getFailed().size())
            .kbJobId(kbResult.getJobId())
            .timestamp(Instant.now())
            .build();

        return ResponseEntity.ok(response);
    }

    /**
     * Extract single firm
     */
    @GetMapping("/extract/{firmId}")
    public ResponseEntity<FirmProfileDocument> extractFirm(@PathVariable Long firmId) {
        return extractionService.extractFirm(firmId)
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }

    /**
     * Get extraction statistics
     */
    @GetMapping("/stats")
    public ResponseEntity<ExtractionStats> getStats() {
        return ResponseEntity.ok(extractionService.getStats());
    }

    /**
     * Check knowledge base ingestion job status
     */
    @GetMapping("/kb-status/{jobId}")
    public ResponseEntity<IngestionJobStatus> getKbStatus(@PathVariable String jobId) {
        return ResponseEntity.ok(kbSyncService.checkJobStatus(jobId));
    }

    /**
     * Validate S3 bucket connectivity
     */
    @GetMapping("/validate-s3")
    public ResponseEntity<Map<String, Boolean>> validateS3() {
        boolean valid = s3SyncService.validateBucket();
        return ResponseEntity.ok(Map.of("valid", valid));
    }
}
```

## Configuration

### application.properties additions

```properties
# Data Extraction Configuration
firm-matching.extraction.scheduler.enabled=true
firm-matching.extraction.scheduler.cron=0 0 2 * * *
firm-matching.extraction.sync-on-startup=false

# S3 Configuration
aws.s3.bucket-name=flo-firm-profiles-kb
aws.s3.prefix=firms/

# Knowledge Base Configuration
aws.bedrock.knowledge-base.id=${AWS_BEDROCK_KB_ID:}
aws.bedrock.knowledge-base.data-source-id=${AWS_BEDROCK_KB_DS_ID:}
```

## Gradle Dependencies

Add to build.gradle if not present:

```gradle
dependencies {
    // ... existing dependencies ...

    // AWS S3 SDK
    implementation 'software.amazon.awssdk:s3'

    // AWS Bedrock Agent SDK (for KB sync)
    implementation 'software.amazon.awssdk:bedrockagent'
}
```

## Usage

### Manual Sync via REST API

```bash
# Sync all firms
curl -X POST http://localhost:8084/api/v1/data-extraction/sync-all

# Sync firms updated since specific time
curl -X POST "http://localhost:8084/api/v1/data-extraction/sync-since?since=2025-01-01T00:00:00Z"

# Extract single firm
curl http://localhost:8084/api/v1/data-extraction/extract/123

# Get stats
curl http://localhost:8084/api/v1/data-extraction/stats

# Check KB sync job status
curl http://localhost:8084/api/v1/data-extraction/kb-status/JOB-ID-HERE
```

### Automated Schedule

- Runs daily at 2 AM (configurable via cron expression)
- Only syncs firms updated since last successful sync
- Automatically triggers knowledge base ingestion

### Programmatic Usage

```java
@Service
public class SomeService {
    private final FirmExtractionService extractionService;
    private final S3SyncService s3SyncService;

    public void customSync() {
        // Extract specific firms
        List<FirmProfileDocument> docs = extractionService.extractAllFirms();

        // Upload to S3
        s3SyncService.uploadDocuments(docs);

        // Trigger KB sync
        kbSyncService.startSync();
    }
}
```

## Monitoring & Logging

### Metrics to Track

1. **Extraction Metrics**:
   - Number of firms extracted
   - Extraction duration
   - Transformation errors

2. **S3 Upload Metrics**:
   - Upload success rate
   - Upload duration
   - Failed uploads

3. **KB Sync Metrics**:
   - Ingestion job duration
   - Ingestion success/failure rate
   - Time since last successful sync

### Log Statements

All services include structured logging:
- INFO: Successful operations, counts, durations
- WARN: Partial failures, retries
- ERROR: Complete failures with stack traces

## Error Handling

### Database Extraction Errors
- Log error and skip problematic firm
- Continue with remaining firms
- Return partial results

### S3 Upload Errors
- Retry failed uploads (3 attempts)
- Log failures for manual review
- Don't block on individual failures

### KB Sync Errors
- Don't retry automatically (long-running)
- Alert on failure
- Provide manual retry via API

## Testing Strategy

### Unit Tests
- Test transformer logic
- Test entity relationships
- Mock external dependencies (S3, Bedrock)

### Integration Tests
- Test full extraction pipeline
- Use test containers for PostgreSQL
- Mock AWS services or use LocalStack

### Manual Testing
1. Extract small batch of firms
2. Verify JSON structure
3. Upload to test S3 bucket
4. Check KB sync status
5. Query KB to verify documents are searchable

## Next Steps

1. Create database schema (or connect to existing)
2. Implement JPA entities
3. Implement extraction service
4. Test with sample data
5. Set up S3 bucket
6. Create knowledge base
7. Run full sync
8. Validate RAG queries work

## Security Considerations

- IAM role with minimal permissions (read DB, write S3, invoke Bedrock)
- No credentials in code (use environment variables)
- Encrypt data at rest (S3) and in transit (TLS)
- Audit log all extraction/sync operations
