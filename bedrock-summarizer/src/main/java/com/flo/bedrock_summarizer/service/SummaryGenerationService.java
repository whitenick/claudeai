package com.flo.bedrock_summarizer.service;

import com.flo.bedrock_summarizer.aws.BedrockAiService;
import com.flo.bedrock_summarizer.domain.AdminNote;
import com.flo.bedrock_summarizer.domain.AiSummary;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Service for orchestrating AI summary generation.
 *
 * This service handles the business logic for:
 * - Fetching admin notes for summarization
 * - Invoking AWS Bedrock AI models
 * - Storing generated summaries
 * - Managing summary lifecycle
 */
@Service
@Slf4j
public class SummaryGenerationService {

    private final BedrockAiService bedrockAiService;

    @Value("${summarization.batch.max-notes-per-summary:50}")
    private int maxNotesPerSummary;

    @Value("${summarization.batch.default-note-limit:20}")
    private int defaultNoteLimit;

    public SummaryGenerationService(BedrockAiService bedrockAiService) {
        this.bedrockAiService = bedrockAiService;
    }

    /**
     * Generate a summary for a list of admin notes.
     *
     * @param notes List of admin notes to summarize
     * @param studentId Student ID for the summary
     * @return Generated AI summary
     */
    public AiSummary generateSummary(List<AdminNote> notes, UUID studentId) {
        if (notes == null || notes.isEmpty()) {
            throw new IllegalArgumentException("Cannot generate summary for empty notes");
        }

        if (notes.size() > maxNotesPerSummary) {
            log.warn("Note count {} exceeds maximum {}, truncating", notes.size(), maxNotesPerSummary);
            notes = notes.subList(0, maxNotesPerSummary);
        }

        long startTime = System.currentTimeMillis();

        // Generate the AI summary
        String summaryText = bedrockAiService.generateSummary(notes);

        long generationTime = System.currentTimeMillis() - startTime;

        // Extract note IDs
        List<UUID> noteIds = notes.stream()
                .map(AdminNote::getId)
                .toList();

        // Build and return the summary domain object
        return AiSummary.builder()
                .id(UUID.randomUUID())
                .studentId(studentId)
                .summary(summaryText)
                .noteIds(noteIds)
                .modelUsed("bedrock-ai") // Could be extracted from BedrockAiService
                .tokenCount(estimateTokenCount(summaryText))
                .generationTimeMs(generationTime)
                .createdAt(Instant.now())
                .build();
    }

    /**
     * Generate summaries for multiple students in batch.
     *
     * @param studentIds List of student IDs
     * @return List of generated summaries
     */
    public List<AiSummary> generateBatchSummaries(List<UUID> studentIds) {
        log.info("Generating summaries for {} students", studentIds.size());

        return studentIds.stream()
                .map(this::generateSummaryForStudent)
                .toList();
    }

    /**
     * Generate a summary for a single student.
     * This method would typically fetch notes from a repository.
     *
     * @param studentId Student ID
     * @return Generated summary
     */
    private AiSummary generateSummaryForStudent(UUID studentId) {
        // In a real implementation, this would fetch notes from the repository
        // For now, we'll create a mock implementation
        log.info("Generating summary for student: {}", studentId);

        // TODO: Implement note fetching from repository
        List<AdminNote> notes = fetchNotesForStudent(studentId);

        return generateSummary(notes, studentId);
    }

    /**
     * Fetch admin notes for a student.
     * TODO: This should call the AdminNoteRepository
     */
    private List<AdminNote> fetchNotesForStudent(UUID studentId) {
        // Mock implementation - would be replaced with actual repository call
        log.debug("Fetching notes for student: {}", studentId);
        return List.of();
    }

    /**
     * Estimate token count for billing/monitoring purposes.
     * Simple approximation: ~4 characters per token for English text.
     */
    private int estimateTokenCount(String text) {
        if (text == null) {
            return 0;
        }
        return text.length() / 4;
    }

    /**
     * Check if summary generation is available.
     */
    public boolean isSummaryGenerationAvailable() {
        return bedrockAiService.isServiceAvailable();
    }
}
