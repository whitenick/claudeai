package com.flo.firm_matching.domain;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.UUID;

/**
 * Student preferences for firm matching
 *
 * Captures a student's preferences for practice areas, geography, firm size,
 * work arrangement, culture, and compensation to match with appropriate law firms.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StudentPreferences {

    private UUID studentId;

    private List<PracticeAreaPreference> practiceAreas;
    private GeographyPreference geography;
    private FirmSizePreference firmSize;
    private WorkArrangementPreference workArrangement;
    private CulturePreference culture;
    private CompensationPreference compensation;
    private StudentBackground background;
    private QueryContext queryContext;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class PracticeAreaPreference {
        private String area;
        private Priority priority;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class GeographyPreference {
        private List<String> preferredCities;
        private Boolean willingToRelocate;
        private String regionalPreference;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class FirmSizePreference {
        private FirmSize preference;
        private Integer minAttorneys;
        private Integer maxAttorneys;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class WorkArrangementPreference {
        private RemoteFlexibility remoteFlexibility;
        private Integer maxDaysInOffice;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CulturePreference {
        private List<String> priorities;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CompensationPreference {
        private Integer minimumSummerSalary;
        private String financialTransparency;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class StudentBackground {
        private String lawSchool;
        private Integer graduationYear;
        private String classRank;
        private Boolean journalExperience;
        private String priorWorkExperience;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class QueryContext {
        private SearchType searchType;
        private String explicitQuery;
    }

    public enum Priority {
        HIGH, MEDIUM, LOW
    }

    public enum FirmSize {
        SMALL, MEDIUM, LARGE
    }

    public enum RemoteFlexibility {
        FULLY_REMOTE, HYBRID_PREFERRED, IN_OFFICE
    }

    public enum SearchType {
        SUMMER_ASSOCIATE, FULL_TIME, LATERAL
    }
}
