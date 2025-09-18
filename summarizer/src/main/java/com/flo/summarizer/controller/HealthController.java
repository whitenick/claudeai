package com.flo.summarizer.controller;

import com.flo.summarizer.service.AiSummaryService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDateTime;
import java.util.Map;

/**
 * Health check controller using Java 21 features
 * Provides application health and status information
 */
@RestController
@RequestMapping("/api/health")
public class HealthController {

    private final AiSummaryService aiSummaryService;

    @Autowired
    public HealthController(AiSummaryService aiSummaryService) {
        this.aiSummaryService = aiSummaryService;
    }

    /**
     * Basic health check endpoint using Java 21 string templates
     */
    @GetMapping
    public ResponseEntity<Map<String, Object>> health() {
        var javaVersion = Runtime.version().feature();
        var uptime = java.lang.management.ManagementFactory.getRuntimeMXBean().getUptime();

        var health = Map.of(
            "status", "UP",
            "timestamp", LocalDateTime.now(),
            "application", "Flo Summarizer",
            "version", "1.0.0",
            "javaVersion", javaVersion,
            "uptimeMs", uptime,
            "message", STR."Running on Java \{javaVersion} with Spring Boot 3.3.3"
        );

        return ResponseEntity.ok(health);
    }

    /**
     * Detailed status including service dependencies using Java 21 features
     */
    @GetMapping("/status")
    public ResponseEntity<Map<String, Object>> status() {
        var javaVersion = Runtime.version().feature();
        var runtime = Runtime.getRuntime();
        var maxMemory = runtime.maxMemory() / (1024 * 1024); // MB
        var totalMemory = runtime.totalMemory() / (1024 * 1024); // MB
        var freeMemory = runtime.freeMemory() / (1024 * 1024); // MB

        var systemInfo = Map.of(
            "processors", runtime.availableProcessors(),
            "maxMemoryMB", maxMemory,
            "totalMemoryMB", totalMemory,
            "freeMemoryMB", freeMemory,
            "usedMemoryMB", totalMemory - freeMemory
        );

        var status = Map.of(
            "status", "UP",
            "timestamp", LocalDateTime.now(),
            "application", "Flo Summarizer",
            "version", "1.0.0",
            "javaVersion", javaVersion,
            "springBootVersion", "3.3.3",
            "system", systemInfo,
            "services", Map.of(
                "database", "UP (H2)",
                "aiService", aiSummaryService.isAiServiceAvailable() ? "UP" : "DOWN"
            ),
            "features", Map.of(
                "stringTemplates", "Enabled",
                "patternMatching", "Enabled",
                "records", "Enabled",
                "textBlocks", "Enabled"
            )
        );

        return ResponseEntity.ok(status);
    }

    /**
     * Java version information endpoint
     */
    @GetMapping("/java")
    public ResponseEntity<Map<String, Object>> javaInfo() {
        var version = Runtime.version();

        var javaInfo = Map.of(
            "version", version.toString(),
            "feature", version.feature(),
            "interim", version.interim(),
            "update", version.update(),
            "patch", version.patch(),
            "vendor", System.getProperty("java.vendor"),
            "runtimeName", System.getProperty("java.runtime.name"),
            "vmName", System.getProperty("java.vm.name"),
            "previewEnabled", "--enable-preview".equals(
                java.lang.management.ManagementFactory.getRuntimeMXBean()
                    .getInputArguments().stream()
                    .filter(arg -> arg.contains("enable-preview"))
                    .findFirst()
                    .orElse("disabled")
            )
        );

        return ResponseEntity.ok(javaInfo);
    }
}