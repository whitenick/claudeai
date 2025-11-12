package com.flo.bedrock_summarizer.domain;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.UUID;

/**
 * Domain model representing an administrative note.
 *
 * Admin notes are created by educators and contain observations,
 * interactions, or important information about students.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AdminNote {

    private UUID id;
    private UUID studentId;
    private String content;
    private UUID authorId;
    private Instant createdAt;
    private Instant updatedAt;
}
