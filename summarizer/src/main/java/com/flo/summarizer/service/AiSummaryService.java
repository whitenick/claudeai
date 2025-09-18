package com.flo.summarizer.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * Service for AI-powered content summarization
 * Built with Java 21 features including pattern matching and string templates
 */
@Service
public class AiSummaryService {

    private static final Logger logger = LoggerFactory.getLogger(AiSummaryService.class);

    /**
     * Generate AI summary for the given content using Java 21 features
     */
    public String generateSummary(String content) {
        logger.info("Generating AI summary for content of length: {}", content.length());

        try {
            // Simulate processing time
            Thread.sleep(500);

            // Use Java 21 pattern matching for content analysis
            var summary = switch (content) {
                case null -> "No content provided for summarization.";
                case String c when c.isBlank() -> "Empty content cannot be summarized.";
                case String c when c.length() < 10 -> STR."Very short content: \{c}";
                default -> createAdvancedSummary(content);
            };

            logger.info("AI summary generated successfully");
            return summary;

        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            logger.error("AI summary generation interrupted", e);
            throw new RuntimeException("AI summary generation failed", e);
        } catch (Exception e) {
            logger.error("Error generating AI summary", e);
            throw new RuntimeException("AI summary generation failed", e);
        }
    }

    /**
     * Create an advanced summary using Java 21 features
     */
    private String createAdvancedSummary(String content) {
        // Use Java 21 string templates and pattern matching
        var analysis = analyzeContent(content);

        return STR."""
               🤖 AI SUMMARY

               Content Analysis:
               • Word Count: \{analysis.wordCount()}
               • Sentence Count: \{analysis.sentenceCount()}
               • Complexity: \{analysis.complexity()}

               Key Insights:
               \{analysis.keyInsight()}

               Summary:
               \{analysis.briefSummary()}

               Generated with Java 21 AI Service
               """;
    }

    /**
     * Analyze content using modern Java 21 record pattern
     */
    private ContentAnalysis analyzeContent(String content) {
        var words = content.split("\\s+");
        var sentences = content.split("[.!?]+");

        var wordCount = words.length;
        var sentenceCount = sentences.length;

        var complexity = switch (wordCount) {
            case int wc when wc < 50 -> "Simple";
            case int wc when wc < 200 -> "Moderate";
            case int wc when wc < 500 -> "Complex";
            default -> "Very Complex";
        };

        var keyInsight = switch (content.toLowerCase()) {
            case String c when c.contains("spring") || c.contains("java") ->
                "Technical documentation about Java/Spring development";
            case String c when c.contains("admin") || c.contains("note") ->
                "Administrative notes and documentation";
            case String c when c.contains("ai") || c.contains("summary") ->
                "Content related to AI and summarization";
            default -> "General documentation or notes";
        };

        var briefSummary = sentences.length > 0 ?
            STR."Begins with: \{sentences[0].trim()}..." :
            "Content analysis complete.";

        return new ContentAnalysis(wordCount, sentenceCount, complexity, keyInsight, briefSummary);
    }

    /**
     * Java 21 record for content analysis
     */
    public record ContentAnalysis(
        int wordCount,
        int sentenceCount,
        String complexity,
        String keyInsight,
        String briefSummary
    ) {}

    /**
     * Check if AI service is available using pattern matching
     */
    public boolean isAiServiceAvailable() {
        return switch (System.getProperty("ai.service.enabled", "true")) {
            case "true", "yes", "1" -> true;
            case "false", "no", "0" -> false;
            default -> true; // Default to available
        };
    }

    /**
     * Get AI service status using string templates
     */
    public String getServiceStatus() {
        var available = isAiServiceAvailable();
        var javaVersion = Runtime.version().feature();

        return STR."""
               AI Service Status: \{available ? "✅ Available" : "❌ Unavailable"}
               Java Version: \{javaVersion}
               Service Type: Mock AI Implementation
               """;
    }
}