package com.flo.bedrock_summarizer.controller;

import com.flo.bedrock_summarizer.aws.BedrockAiService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

/**
 * Health check controller for service monitoring.
 *
 * Provides endpoints for:
 * - Basic service health
 * - Detailed service status
 * - AWS Bedrock connectivity check
 */
@RestController
@RequestMapping("/health")
@Tag(name = "Health", description = "Service health and status endpoints")
@Slf4j
public class HealthController {

    private final BedrockAiService bedrockAiService;

    public HealthController(BedrockAiService bedrockAiService) {
        this.bedrockAiService = bedrockAiService;
    }

    @GetMapping
    @Operation(summary = "Basic health check")
    public ResponseEntity<Map<String, Object>> health() {
        Map<String, Object> health = new HashMap<>();
        health.put("status", "UP");
        health.put("service", "bedrock-summarizer");
        health.put("timestamp", Instant.now());
        health.put("java.version", System.getProperty("java.version"));

        return ResponseEntity.ok(health);
    }

    @GetMapping("/status")
    @Operation(summary = "Detailed service status")
    public ResponseEntity<Map<String, Object>> status() {
        Map<String, Object> status = new HashMap<>();
        status.put("service", "bedrock-summarizer");
        status.put("status", "UP");
        status.put("timestamp", Instant.now());

        // JVM Info
        Map<String, Object> jvmInfo = new HashMap<>();
        jvmInfo.put("version", System.getProperty("java.version"));
        jvmInfo.put("vendor", System.getProperty("java.vendor"));
        jvmInfo.put("runtime", System.getProperty("java.runtime.name"));
        status.put("jvm", jvmInfo);

        // Memory Info
        Runtime runtime = Runtime.getRuntime();
        Map<String, Object> memoryInfo = new HashMap<>();
        memoryInfo.put("totalMemoryMB", runtime.totalMemory() / (1024 * 1024));
        memoryInfo.put("freeMemoryMB", runtime.freeMemory() / (1024 * 1024));
        memoryInfo.put("maxMemoryMB", runtime.maxMemory() / (1024 * 1024));
        memoryInfo.put("usedMemoryMB", (runtime.totalMemory() - runtime.freeMemory()) / (1024 * 1024));
        status.put("memory", memoryInfo);

        // Bedrock Status
        boolean bedrockAvailable = bedrockAiService.isServiceAvailable();
        status.put("bedrock", Map.of(
                "available", bedrockAvailable,
                "status", bedrockAvailable ? "CONNECTED" : "UNAVAILABLE"
        ));

        return ResponseEntity.ok(status);
    }

    @GetMapping("/bedrock")
    @Operation(summary = "AWS Bedrock service health check")
    public ResponseEntity<Map<String, Object>> bedrockHealth() {
        Map<String, Object> bedrockStatus = new HashMap<>();

        boolean available = bedrockAiService.isServiceAvailable();
        bedrockStatus.put("available", available);
        bedrockStatus.put("status", available ? "UP" : "DOWN");
        bedrockStatus.put("statusDetails", bedrockAiService.getServiceStatus());
        bedrockStatus.put("timestamp", Instant.now());

        return ResponseEntity.ok(bedrockStatus);
    }

    @GetMapping("/ping")
    @Operation(summary = "Simple ping endpoint")
    public ResponseEntity<String> ping() {
        return ResponseEntity.ok("pong");
    }
}
