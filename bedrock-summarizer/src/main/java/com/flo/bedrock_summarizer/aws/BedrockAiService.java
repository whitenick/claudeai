package com.flo.bedrock_summarizer.aws;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.flo.bedrock_summarizer.domain.AdminNote;
import com.flo.bedrock_summarizer.exception.BedrockServiceException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.core.SdkBytes;
import software.amazon.awssdk.services.bedrockruntime.BedrockRuntimeClient;
import software.amazon.awssdk.services.bedrockruntime.model.InvokeModelRequest;
import software.amazon.awssdk.services.bedrockruntime.model.InvokeModelResponse;

import java.time.Instant;
import java.util.List;
import java.util.stream.Collectors;

/**
 * Service for interacting with AWS Bedrock foundation models.
 *
 * Provides AI-powered summarization using various Bedrock models:
 * - Amazon Titan Text Express (primary - cost-effective)
 * - Anthropic Claude on Bedrock (fallback - superior reasoning)
 * - AI21 Labs Jurassic-2 (alternative)
 */
@Service
@Slf4j
public class BedrockAiService {

    private final BedrockRuntimeClient bedrockClient;
    private final ObjectMapper objectMapper;

    @Value("${aws.bedrock.model-id:amazon.titan-text-express-v1}")
    private String primaryModelId;

    @Value("${aws.bedrock.fallback-model-id:anthropic.claude-v2}")
    private String fallbackModelId;

    @Value("${aws.bedrock.max-tokens:2000}")
    private int maxTokens;

    @Value("${aws.bedrock.temperature:0.1}")
    private double temperature;

    public BedrockAiService(BedrockRuntimeClient bedrockClient, ObjectMapper objectMapper) {
        this.bedrockClient = bedrockClient;
        this.objectMapper = objectMapper;
    }

    /**
     * Generate an AI summary for a list of admin notes.
     *
     * @param notes List of admin notes to summarize
     * @return Generated summary text
     * @throws BedrockServiceException if AI generation fails
     */
    public String generateSummary(List<AdminNote> notes) {
        if (notes == null || notes.isEmpty()) {
            throw new IllegalArgumentException("Cannot generate summary for empty notes list");
        }

        long startTime = System.currentTimeMillis();
        String prompt = buildSummarizationPrompt(notes);

        try {
            log.info("Generating summary for {} notes using model: {}", notes.size(), primaryModelId);
            String summary = invokeModel(primaryModelId, prompt);
            long duration = System.currentTimeMillis() - startTime;
            log.info("Summary generated successfully in {}ms", duration);
            return summary;
        } catch (Exception e) {
            log.warn("Primary model {} failed, attempting fallback to {}", primaryModelId, fallbackModelId, e);
            try {
                String summary = invokeModel(fallbackModelId, prompt);
                long duration = System.currentTimeMillis() - startTime;
                log.info("Summary generated using fallback model in {}ms", duration);
                return summary;
            } catch (Exception fallbackException) {
                log.error("Both primary and fallback models failed", fallbackException);
                throw new BedrockServiceException("Failed to generate AI summary", fallbackException);
            }
        }
    }

    /**
     * Invoke a specific Bedrock model with the given prompt.
     */
    private String invokeModel(String modelId, String prompt) {
        try {
            String requestBody = buildRequestBody(modelId, prompt);

            InvokeModelRequest request = InvokeModelRequest.builder()
                    .modelId(modelId)
                    .contentType("application/json")
                    .accept("application/json")
                    .body(SdkBytes.fromUtf8String(requestBody))
                    .build();

            InvokeModelResponse response = bedrockClient.invokeModel(request);
            return parseResponse(modelId, response.body().asUtf8String());
        } catch (Exception e) {
            log.error("Error invoking model {}", modelId, e);
            throw new BedrockServiceException("Model invocation failed for " + modelId, e);
        }
    }

    /**
     * Build the request body based on the model type.
     */
    private String buildRequestBody(String modelId, String prompt) {
        try {
            ObjectNode requestBody = objectMapper.createObjectNode();

            if (modelId.startsWith("amazon.titan")) {
                // Amazon Titan request format
                ObjectNode textGenerationConfig = objectMapper.createObjectNode();
                textGenerationConfig.put("maxTokenCount", maxTokens);
                textGenerationConfig.put("temperature", temperature);
                textGenerationConfig.put("topP", 0.9);

                requestBody.put("inputText", prompt);
                requestBody.set("textGenerationConfig", textGenerationConfig);

            } else if (modelId.startsWith("anthropic.claude")) {
                // Anthropic Claude request format
                requestBody.put("prompt", "\\n\\nHuman: " + prompt + "\\n\\nAssistant:");
                requestBody.put("max_tokens_to_sample", maxTokens);
                requestBody.put("temperature", temperature);
                requestBody.put("top_p", 0.9);
            }

            return objectMapper.writeValueAsString(requestBody);
        } catch (Exception e) {
            throw new BedrockServiceException("Failed to build request body", e);
        }
    }

    /**
     * Parse the model response based on model type.
     */
    private String parseResponse(String modelId, String responseBody) {
        try {
            ObjectNode response = (ObjectNode) objectMapper.readTree(responseBody);

            if (modelId.startsWith("amazon.titan")) {
                return response.get("results").get(0).get("outputText").asText();
            } else if (modelId.startsWith("anthropic.claude")) {
                return response.get("completion").asText();
            }

            throw new BedrockServiceException("Unknown model format: " + modelId);
        } catch (Exception e) {
            throw new BedrockServiceException("Failed to parse response", e);
        }
    }

    /**
     * Build a comprehensive prompt for note summarization.
     */
    private String buildSummarizationPrompt(List<AdminNote> notes) {
        String notesText = notes.stream()
                .map(note -> String.format(
                    "Date: %s\\nAuthor: %s\\nContent: %s",
                    note.getCreatedAt(),
                    note.getAuthorId(),
                    note.getContent()
                ))
                .collect(Collectors.joining("\\n\\n---\\n\\n"));

        return String.format("""
            You are an educational assistant analyzing administrative notes about students.

            Task: Generate a comprehensive summary of the following %d administrative notes.

            Notes:
            %s

            Requirements:
            - Identify key themes and patterns across the notes
            - Highlight important observations or milestones
            - Note any concerns or areas needing attention
            - Provide actionable insights for educators
            - Keep the summary concise (200-300 words)
            - Use clear, professional language

            Format the response as a structured summary with sections for:
            1. Overview
            2. Key Themes
            3. Important Observations
            4. Recommendations
            """, notes.size(), notesText);
    }

    /**
     * Check if the Bedrock service is available.
     */
    public boolean isServiceAvailable() {
        try {
            // Attempt a simple model list operation to verify connectivity
            bedrockClient.listFoundationModels();
            return true;
        } catch (Exception e) {
            log.error("Bedrock service unavailable", e);
            return false;
        }
    }

    /**
     * Get the status of the Bedrock AI service.
     */
    public String getServiceStatus() {
        boolean available = isServiceAvailable();
        return String.format("""
            Bedrock AI Service Status: %s
            Primary Model: %s
            Fallback Model: %s
            Max Tokens: %d
            Temperature: %.2f
            """,
            available ? "Available" : "Unavailable",
            primaryModelId,
            fallbackModelId,
            maxTokens,
            temperature
        );
    }
}
