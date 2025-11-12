package com.flo.bedrock_summarizer.controller;

import com.flo.bedrock_summarizer.domain.AdminNote;
import com.flo.bedrock_summarizer.domain.AiSummary;
import com.flo.bedrock_summarizer.service.SummaryGenerationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

/**
 * REST controller for AI summary operations.
 *
 * Provides endpoints for:
 * - Generating summaries from admin notes
 * - Retrieving existing summaries
 * - Batch summary generation
 */
@RestController
@RequestMapping("/summaries")
@Tag(name = "AI Summaries", description = "AI-powered summary generation and retrieval")
@Slf4j
public class SummaryController {

    private final SummaryGenerationService summaryGenerationService;

    public SummaryController(SummaryGenerationService summaryGenerationService) {
        this.summaryGenerationService = summaryGenerationService;
    }

    @PostMapping("/generate")
    @Operation(summary = "Generate AI summary from admin notes")
    @ApiResponse(responseCode = "200", description = "Summary generated successfully")
    @ApiResponse(responseCode = "400", description = "Invalid request", content = @Content())
    @ApiResponse(responseCode = "500", description = "AI service error", content = @Content())
    public ResponseEntity<AiSummary> generateSummary(
            @RequestParam UUID studentId,
            @RequestBody List<AdminNote> notes) {

        log.info("Generating summary for student {} with {} notes", studentId, notes.size());

        AiSummary summary = summaryGenerationService.generateSummary(notes, studentId);

        return ResponseEntity.ok(summary);
    }

    @GetMapping("/student/{studentId}")
    @Operation(summary = "Get all summaries for a student")
    @ApiResponse(responseCode = "200", description = "Summaries retrieved successfully")
    @ApiResponse(responseCode = "404", description = "Student not found", content = @Content())
    public ResponseEntity<List<AiSummary>> getSummariesForStudent(
            @PathVariable UUID studentId) {

        log.info("Fetching summaries for student: {}", studentId);

        // TODO: Implement repository call to fetch existing summaries
        return ResponseEntity.ok(List.of());
    }

    @GetMapping("/{summaryId}")
    @Operation(summary = "Get a specific summary by ID")
    @ApiResponse(responseCode = "200", description = "Summary retrieved successfully")
    @ApiResponse(responseCode = "404", description = "Summary not found", content = @Content())
    public ResponseEntity<AiSummary> getSummary(@PathVariable UUID summaryId) {

        log.info("Fetching summary: {}", summaryId);

        // TODO: Implement repository call to fetch summary
        return ResponseEntity.notFound().build();
    }

    @PostMapping("/batch")
    @Operation(summary = "Generate summaries for multiple students")
    @ApiResponse(responseCode = "200", description = "Summaries generated successfully")
    @ApiResponse(responseCode = "400", description = "Invalid request", content = @Content())
    public ResponseEntity<List<AiSummary>> generateBatchSummaries(
            @RequestBody List<UUID> studentIds) {

        log.info("Generating batch summaries for {} students", studentIds.size());

        List<AiSummary> summaries = summaryGenerationService.generateBatchSummaries(studentIds);

        return ResponseEntity.ok(summaries);
    }

    @GetMapping("/stats")
    @Operation(summary = "Get summary generation statistics")
    @ApiResponse(responseCode = "200", description = "Statistics retrieved successfully")
    public ResponseEntity<SummaryStats> getSummaryStats() {

        log.info("Fetching summary statistics");

        // TODO: Implement statistics gathering
        SummaryStats stats = SummaryStats.builder()
                .totalSummariesGenerated(0L)
                .averageGenerationTimeMs(0L)
                .totalTokensUsed(0L)
                .serviceAvailable(summaryGenerationService.isSummaryGenerationAvailable())
                .build();

        return ResponseEntity.ok(stats);
    }

    /**
     * DTO for summary statistics
     */
    @lombok.Data
    @lombok.Builder
    public static class SummaryStats {
        private Long totalSummariesGenerated;
        private Long averageGenerationTimeMs;
        private Long totalTokensUsed;
        private Boolean serviceAvailable;
    }
}
