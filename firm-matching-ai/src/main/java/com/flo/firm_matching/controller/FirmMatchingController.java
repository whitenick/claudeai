package com.flo.firm_matching.controller;

import com.flo.firm_matching.aws.BedrockAgentService;
import com.flo.firm_matching.domain.FirmMatchResponse;
import com.flo.firm_matching.domain.StudentPreferences;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * REST API Controller for Firm Matching
 *
 * Provides endpoints for matching students with law firms using AI-powered RAG
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/firm-matching")
@RequiredArgsConstructor
@Tag(name = "Firm Matching", description = "AI-powered firm matching using RAG")
public class FirmMatchingController {

    private final BedrockAgentService bedrockAgentService;

    @PostMapping("/match")
    @Operation(summary = "Match firms based on student preferences",
               description = "Uses AWS Bedrock Agent with Claude AI to find matching law firms")
    public ResponseEntity<FirmMatchResponse> matchFirms(
            @RequestBody StudentPreferences preferences) {

        log.info("Received firm matching request for student: {}", preferences.getStudentId());

        try {
            FirmMatchResponse response = bedrockAgentService.matchFirms(preferences);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            log.error("Error matching firms", e);
            return ResponseEntity.internalServerError().build();
        }
    }

    @GetMapping("/health")
    @Operation(summary = "Health check", description = "Check if the service is running")
    public ResponseEntity<Map<String, String>> health() {
        return ResponseEntity.ok(Map.of(
            "status", "UP",
            "service", "firm-matching-ai",
            "timestamp", String.valueOf(System.currentTimeMillis())
        ));
    }

    @GetMapping("/status")
    @Operation(summary = "Service status", description = "Get detailed service status")
    public ResponseEntity<Map<String, Object>> status() {
        return ResponseEntity.ok(Map.of(
            "status", "UP",
            "service", "firm-matching-ai",
            "version", "0.0.1-SNAPSHOT",
            "bedrockConfigured", true,
            "timestamp", System.currentTimeMillis()
        ));
    }
}
