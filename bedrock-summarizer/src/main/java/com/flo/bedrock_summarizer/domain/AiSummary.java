package com.flo.bedrock_summarizer.domain;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Domain model representing an AI-generated summary.
 *
 * Summaries are generated from one or more admin notes and include
 * metadata about the generation process (model used, token count, etc).
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AiSummary {

    private UUID id;
    private UUID studentId;
    private String summary;
    private List<UUID> noteIds;
    private String modelUsed;
    private Integer tokenCount;
    private Long generationTimeMs;
    private Instant createdAt;
}
