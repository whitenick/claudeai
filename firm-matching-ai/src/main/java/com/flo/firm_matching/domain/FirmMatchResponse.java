package com.flo.firm_matching.domain;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.List;

/**
 * Response containing matched firms and reasoning
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class FirmMatchResponse {

    private List<FirmMatch> matches;
    private String summary;
    private Integer totalMatches;
    private Instant generatedAt;
    private MatchMetadata metadata;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class FirmMatch {
        private Long firmId;
        private String firmName;
        private String friendlyName;
        private Double matchScore;
        private String matchReason;
        private FirmSummary firmSummary;
        private List<String> matchedCriteria;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class FirmSummary {
        private String bio;
        private List<String> practiceAreas;
        private List<String> officeLocations;
        private Integer totalAttorneys;
        private String workArrangement;
        private String summerProgramDetails;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class MatchMetadata {
        private String modelUsed;
        private Long responseTimeMs;
        private Integer tokensUsed;
        private String sessionId;
    }
}
