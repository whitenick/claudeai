# Spring Boot Migration Guide

This document outlines the migration path from the Node.js/Bun POC to a production Java Spring Boot service.

## Migration Strategy

### Phase 1: Database Compatibility ✅
The PostgreSQL schema and triggers are **100% compatible** with Spring Boot:
- Same table structures
- Same UUID types
- Same pub/sub events
- Same JSON payloads

### Phase 2: Event System Migration

#### Current Node.js Implementation
```typescript
// PostgreSQL LISTEN/NOTIFY
await notificationClient.listen('admin_notes_created', async (payload) => {
  const event = JSON.parse(payload);
  await this.aiService.processAdminNoteCreated(event);
});
```

#### Spring Boot Equivalent
```java
@Component
@Slf4j
public class PostgresEventListener {

    @Autowired
    private AiSummaryService aiSummaryService;

    private Connection connection;
    private Statement statement;

    @PostConstruct
    public void startListening() throws SQLException {
        connection = dataSource.getConnection();
        statement = connection.createStatement();

        // Listen to PostgreSQL notifications
        statement.execute("LISTEN admin_notes_created");

        // Start polling for notifications
        startNotificationPolling();
    }

    @Async
    public void startNotificationPolling() {
        while (!Thread.currentThread().isInterrupted()) {
            try {
                PGNotification[] notifications =
                    ((PGConnection) connection).getNotifications(1000);

                if (notifications != null) {
                    for (PGNotification notification : notifications) {
                        handleNotification(notification);
                    }
                }
            } catch (SQLException e) {
                log.error("Error polling for notifications", e);
            }
        }
    }

    private void handleNotification(PGNotification notification) {
        try {
            String channel = notification.getName();
            String payload = notification.getParameter();

            if ("admin_notes_created".equals(channel)) {
                AdminNoteEvent event = objectMapper.readValue(payload, AdminNoteEvent.class);
                aiSummaryService.processAdminNoteCreated(event);
            }
        } catch (Exception e) {
            log.error("Error handling notification", e);
        }
    }
}
```

### Phase 3: REST API Migration

#### Current Fastify Routes
```typescript
fastify.post('/admin-notes', async (request, reply) => {
  const data = createAdminNoteSchema.parse(request.body);
  const [newNote] = await db.insert(adminNotes).values(data).returning();
  return { success: true, note: newNote };
});
```

#### Spring Boot Controllers
```java
@RestController
@RequestMapping("/api")
@Validated
public class AdminNotesController {

    @Autowired
    private AdminNotesService adminNotesService;

    @PostMapping("/admin-notes")
    public ResponseEntity<AdminNoteResponse> createAdminNote(
            @Valid @RequestBody CreateAdminNoteRequest request) {

        AdminNote note = adminNotesService.createNote(request);
        return ResponseEntity.ok(new AdminNoteResponse(true, note));
    }

    @GetMapping("/students/{studentId}/summaries")
    public ResponseEntity<List<AiSummary>> getStudentSummaries(
            @PathVariable @Valid UUID studentId) {

        List<AiSummary> summaries = aiSummaryService.getSummariesForStudent(studentId);
        return ResponseEntity.ok(summaries);
    }
}
```

### Phase 4: AI Service Migration

#### Current Claude Integration
```typescript
private async generateSummary(notes: AdminNote[]): Promise<string> {
  const response = await this.claude.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 1500,
    temperature: 0.1,
    system: "You are an educational assistant...",
    messages: [{ role: 'user', content: prompt }]
  });
  return response.content[0].text;
}
```

#### Spring Boot AI Service
```java
@Service
@Slf4j
public class ClaudeAiService {

    @Value("${claude.api.key}")
    private String claudeApiKey;

    private final RestTemplate restTemplate;

    public String generateSummary(List<AdminNote> notes) {
        ClaudeRequest request = ClaudeRequest.builder()
            .model("claude-3-5-sonnet-20241022")
            .maxTokens(1500)
            .temperature(0.1)
            .system("You are an educational assistant...")
            .messages(List.of(new Message("user", buildPrompt(notes))))
            .build();

        try {
            ClaudeResponse response = restTemplate.postForObject(
                "https://api.anthropic.com/v1/messages",
                request,
                ClaudeResponse.class
            );

            return response.getContent().get(0).getText();
        } catch (Exception e) {
            log.error("Failed to generate AI summary", e);
            throw new AiServiceException("AI summary generation failed", e);
        }
    }
}
```

## Project Structure Mapping

### Current Node.js Structure
```
src/
├── db/
│   ├── schema.ts           → JPA Entities
│   └── index.ts           → DataSource Configuration
├── services/
│   ├── ai-service.ts      → @Service classes
│   └── event-listener.ts  → @Component listeners
├── routes/
│   └── admin-notes.ts     → @RestController
└── types/
    └── events.ts          → DTO classes
```

### Spring Boot Structure
```
src/main/java/com/flo/adminnotes/
├── entity/
│   ├── AdminNote.java
│   └── AiSummary.java
├── repository/
│   ├── AdminNoteRepository.java
│   └── AiSummaryRepository.java
├── service/
│   ├── AdminNotesService.java
│   ├── AiSummaryService.java
│   └── ClaudeAiService.java
├── controller/
│   └── AdminNotesController.java
├── config/
│   └── DatabaseConfig.java
├── dto/
│   ├── CreateAdminNoteRequest.java
│   └── AdminNoteResponse.java
└── event/
    ├── PostgresEventListener.java
    └── AdminNoteEvent.java
```

## Dependencies Migration

### Current package.json → Maven/Gradle

#### Node.js Dependencies
```json
{
  "dependencies": {
    "@anthropic-ai/sdk": "^0.24.3",
    "fastify": "^4.24.3",
    "drizzle-orm": "^0.29.1",
    "postgres": "^3.4.3",
    "zod": "^3.22.4"
  }
}
```

#### Maven Dependencies (pom.xml)
```xml
<dependencies>
    <!-- Spring Boot Starters -->
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-web</artifactId>
    </dependency>
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-data-jpa</artifactId>
    </dependency>
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-validation</artifactId>
    </dependency>

    <!-- Database -->
    <dependency>
        <groupId>org.postgresql</groupId>
        <artifactId>postgresql</artifactId>
    </dependency>

    <!-- HTTP Client for Claude API -->
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-webflux</artifactId>
    </dependency>

    <!-- JSON Processing -->
    <dependency>
        <groupId>com.fasterxml.jackson.core</groupId>
        <artifactId>jackson-databind</artifactId>
    </dependency>
</dependencies>
```

## Data Models Migration

### Current TypeScript Types
```typescript
export const adminNotes = pgTable('admin_notes', {
  id: uuid('id').primaryKey().defaultRandom(),
  studentId: uuid('student_id').notNull(),
  content: text('content').notNull(),
  authorId: uuid('author_id').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});
```

### Spring Boot JPA Entities
```java
@Entity
@Table(name = "admin_notes")
public class AdminNote {

    @Id
    @GeneratedValue(generator = "UUID")
    @GenericGenerator(name = "UUID", strategy = "uuid2")
    private UUID id;

    @Column(name = "student_id", nullable = false)
    private UUID studentId;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String content;

    @Column(name = "author_id", nullable = false)
    private UUID authorId;

    @Column(name = "created_at", nullable = false)
    @CreationTimestamp
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    @UpdateTimestamp
    private Instant updatedAt;

    // Constructors, getters, setters
}

@Repository
public interface AdminNoteRepository extends JpaRepository<AdminNote, UUID> {

    @Query("SELECT a FROM AdminNote a WHERE a.studentId = :studentId ORDER BY a.createdAt DESC")
    List<AdminNote> findByStudentIdOrderByCreatedAtDesc(UUID studentId, Pageable pageable);
}
```

## Configuration Migration

### Current .env → application.yml

#### Node.js Environment
```bash
DATABASE_URL=postgresql://postgres:password@localhost:5432/admin_notes_ai
CLAUDE_API_KEY=sk-ant-...
PORT=3000
LOG_LEVEL=info
```

#### Spring Boot Configuration
```yaml
# application.yml
server:
  port: 8080

spring:
  datasource:
    url: jdbc:postgresql://localhost:5432/admin_notes_ai
    username: postgres
    password: password
    driver-class-name: org.postgresql.Driver

  jpa:
    hibernate:
      ddl-auto: validate
    properties:
      hibernate:
        dialect: org.hibernate.dialect.PostgreSQLDialect
    show-sql: false

  profiles:
    active: development

claude:
  api:
    key: ${CLAUDE_API_KEY}
    base-url: https://api.anthropic.com/v1
    timeout: 30s

logging:
  level:
    com.flo.adminnotes: INFO
    org.springframework.web: DEBUG
```

## Testing Migration

### Current Testing Approach
- Manual API testing via curl
- Seed script for sample data
- Health check endpoints

### Spring Boot Testing
```java
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@TestPropertySource(locations = "classpath:application-test.properties")
class AdminNotesControllerTest {

    @Autowired
    private TestRestTemplate restTemplate;

    @Test
    void shouldCreateAdminNote() {
        CreateAdminNoteRequest request = new CreateAdminNoteRequest();
        request.setStudentId(UUID.randomUUID());
        request.setContent("Test note content");
        request.setAuthorId(UUID.randomUUID());

        ResponseEntity<AdminNoteResponse> response = restTemplate.postForEntity(
            "/api/admin-notes",
            request,
            AdminNoteResponse.class
        );

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody().isSuccess()).isTrue();
    }
}
```

## Docker & Deployment Migration

### Current Docker Compose
The PostgreSQL service remains **identical**:
```yaml
postgres:
  image: postgres:15
  environment:
    POSTGRES_DB: admin_notes_ai
    POSTGRES_USER: postgres
    POSTGRES_PASSWORD: password
```

### Spring Boot Docker
```dockerfile
FROM openjdk:17-jre-slim

WORKDIR /app

COPY target/admin-notes-ai-*.jar app.jar

EXPOSE 8080

CMD ["java", "-jar", "app.jar"]
```

The POC validates the architecture - Spring Boot provides enterprise-grade implementation for production deployment.