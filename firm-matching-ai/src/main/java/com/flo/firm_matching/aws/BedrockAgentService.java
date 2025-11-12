package com.flo.firm_matching.aws;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.flo.firm_matching.domain.FirmMatchResponse;
import com.flo.firm_matching.domain.StudentPreferences;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.core.async.SdkPublisher;
import software.amazon.awssdk.services.bedrockagentruntime.BedrockAgentRuntimeAsyncClient;
import software.amazon.awssdk.services.bedrockagentruntime.model.*;
import software.amazon.awssdk.services.bedrockruntime.BedrockRuntimeClient;
import software.amazon.awssdk.services.bedrockruntime.model.InvokeModelRequest;
import software.amazon.awssdk.services.bedrockruntime.model.InvokeModelResponse;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;

/**
 * AWS Bedrock Agent Service for Firm Matching
 *
 * Handles communication with AWS Bedrock agents for RAG-based firm matching.
 * Can fall back to direct Claude invocation if agent is not configured.
 */
@Slf4j
@Service
public class BedrockAgentService {

    private final BedrockAgentRuntimeAsyncClient agentClient;
    private final BedrockRuntimeClient runtimeClient;
    private final ObjectMapper objectMapper;

    @Value("${aws.bedrock.agent.id:}")
    private String agentId;

    @Value("${aws.bedrock.agent.alias-id}")
    private String agentAliasId;

    @Value("${aws.bedrock.model-id}")
    private String modelId;

    @Value("${aws.bedrock.max-tokens}")
    private Integer maxTokens;

    @Value("${aws.bedrock.temperature}")
    private Double temperature;

    public BedrockAgentService(
            BedrockAgentRuntimeAsyncClient agentClient,
            BedrockRuntimeClient runtimeClient,
            ObjectMapper objectMapper) {
        this.agentClient = agentClient;
        this.runtimeClient = runtimeClient;
        this.objectMapper = objectMapper;
    }

    /**
     * Match firms based on student preferences using Bedrock Agent
     */
    public FirmMatchResponse matchFirms(StudentPreferences preferences) {
        long startTime = System.currentTimeMillis();

        // Check if agent is configured, otherwise fall back to direct invocation
        if (agentId == null || agentId.isEmpty()) {
            log.warn("Bedrock agent not configured, using direct model invocation");
            return matchFirmsDirectly(preferences, startTime);
        }

        try {
            String sessionId = UUID.randomUUID().toString();
            String query = buildQueryFromPreferences(preferences);

            log.info("Invoking Bedrock agent {} with session {}", agentId, sessionId);
            log.debug("Query: {}", query);

            InvokeAgentRequest request = InvokeAgentRequest.builder()
                    .agentId(agentId)
                    .agentAliasId(agentAliasId)
                    .sessionId(sessionId)
                    .inputText(query)
                    .build();

            // Invoke agent and collect response using async handler
            CompletableFuture<String> responseFuture = new CompletableFuture<>();
            StringBuilder responseText = new StringBuilder();

            InvokeAgentResponseHandler responseHandler = InvokeAgentResponseHandler.builder()
                    .onEventStream(publisher -> {
                        publisher.subscribe(event -> {
                            if (event instanceof PayloadPart) {
                                PayloadPart payload = (PayloadPart) event;
                                if (payload.bytes() != null) {
                                    responseText.append(payload.bytes().asUtf8String());
                                }
                            }
                        });
                    })
                    .onComplete(() -> {
                        responseFuture.complete(responseText.toString());
                    })
                    .onError(responseFuture::completeExceptionally)
                    .build();

            agentClient.invokeAgent(request, responseHandler);

            // Wait for response with timeout
            String agentResponse = responseFuture.get(60, TimeUnit.SECONDS);

            long responseTime = System.currentTimeMillis() - startTime;
            log.info("Bedrock agent response received in {}ms", responseTime);

            return parseAgentResponse(agentResponse, sessionId, responseTime);

        } catch (Exception e) {
            log.error("Error invoking Bedrock agent", e);
            throw new RuntimeException("Failed to match firms using Bedrock agent", e);
        }
    }

    /**
     * Fallback: Direct Claude invocation without RAG agent
     */
    private FirmMatchResponse matchFirmsDirectly(StudentPreferences preferences, long startTime) {
        try {
            String prompt = buildPromptForDirectInvocation(preferences);

            String requestBody = String.format("""
                {
                    "anthropic_version": "bedrock-2023-05-31",
                    "max_tokens": %d,
                    "temperature": %.1f,
                    "messages": [
                        {
                            "role": "user",
                            "content": "%s"
                        }
                    ]
                }
                """, maxTokens, temperature, prompt.replace("\"", "\\\"").replace("\n", "\\n"));

            InvokeModelRequest request = InvokeModelRequest.builder()
                    .modelId(modelId)
                    .body(software.amazon.awssdk.core.SdkBytes.fromUtf8String(requestBody))
                    .build();

            InvokeModelResponse response = runtimeClient.invokeModel(request);
            String responseBody = response.body().asUtf8String();

            long responseTime = System.currentTimeMillis() - startTime;
            log.info("Direct Claude invocation completed in {}ms", responseTime);

            return parseDirectResponse(responseBody, responseTime);

        } catch (Exception e) {
            log.error("Error with direct Claude invocation", e);
            throw new RuntimeException("Failed to match firms using direct invocation", e);
        }
    }

    /**
     * Build natural language query from structured preferences
     */
    private String buildQueryFromPreferences(StudentPreferences prefs) {
        StringBuilder query = new StringBuilder();
        query.append("Find law firms that match these criteria:\n\n");

        // Explicit query takes precedence
        if (prefs.getQueryContext() != null && prefs.getQueryContext().getExplicitQuery() != null) {
            return prefs.getQueryContext().getExplicitQuery();
        }

        if (prefs.getPracticeAreas() != null && !prefs.getPracticeAreas().isEmpty()) {
            query.append("Practice Areas: ");
            prefs.getPracticeAreas().forEach(pa ->
                query.append(pa.getArea()).append(" (").append(pa.getPriority()).append("), ")
            );
            query.append("\n");
        }

        if (prefs.getGeography() != null && prefs.getGeography().getPreferredCities() != null) {
            query.append("Locations: ")
                 .append(String.join(", ", prefs.getGeography().getPreferredCities()))
                 .append("\n");
        }

        if (prefs.getFirmSize() != null) {
            query.append("Firm Size: ").append(prefs.getFirmSize().getPreference()).append("\n");
        }

        if (prefs.getWorkArrangement() != null) {
            query.append("Work Arrangement: ")
                 .append(prefs.getWorkArrangement().getRemoteFlexibility())
                 .append("\n");
        }

        if (prefs.getCulture() != null && prefs.getCulture().getPriorities() != null) {
            query.append("Culture Priorities: ")
                 .append(String.join(", ", prefs.getCulture().getPriorities()))
                 .append("\n");
        }

        return query.toString();
    }

    /**
     * Build detailed prompt for direct Claude invocation (without RAG)
     */
    private String buildPromptForDirectInvocation(StudentPreferences prefs) {
        String criteria = buildQueryFromPreferences(prefs);
        return String.format("""
            You are a legal recruitment assistant helping match law students with appropriate law firms.

            Based on the following student preferences, provide recommendations for law firms that would be a good match.
            Since this is a POC without the firm database connected, please provide a structured example response
            showing how the system would work.

            Student Preferences:
            %s

            Please provide:
            1. 3-5 example firm recommendations
            2. Match score (0-100) for each
            3. Explanation of why each firm matches
            4. Any trade-offs or considerations

            Format your response as JSON with this structure:
            {
              "matches": [
                {
                  "firmName": "Example Firm",
                  "matchScore": 85,
                  "matchReason": "Explanation of match",
                  "practiceAreas": ["Area1", "Area2"],
                  "locations": ["City1", "City2"]
                }
              ],
              "summary": "Overall summary of recommendations"
            }
            """, criteria);
    }

    /**
     * Parse agent response into structured match results
     */
    private FirmMatchResponse parseAgentResponse(String responseText, String sessionId, long responseTime) {
        // TODO: Parse actual agent response - for now return mock structure
        log.debug("Parsing agent response: {}", responseText);

        return FirmMatchResponse.builder()
                .matches(new ArrayList<>())
                .summary(responseText)
                .totalMatches(0)
                .generatedAt(Instant.now())
                .metadata(FirmMatchResponse.MatchMetadata.builder()
                        .modelUsed(modelId)
                        .responseTimeMs(responseTime)
                        .sessionId(sessionId)
                        .build())
                .build();
    }

    /**
     * Parse direct Claude response
     */
    private FirmMatchResponse parseDirectResponse(String responseBody, long responseTime) {
        // TODO: Parse Claude JSON response
        log.debug("Parsing direct response: {}", responseBody);

        return FirmMatchResponse.builder()
                .matches(new ArrayList<>())
                .summary("Direct invocation response (POC mode)")
                .totalMatches(0)
                .generatedAt(Instant.now())
                .metadata(FirmMatchResponse.MatchMetadata.builder()
                        .modelUsed(modelId)
                        .responseTimeMs(responseTime)
                        .build())
                .build();
    }

}
