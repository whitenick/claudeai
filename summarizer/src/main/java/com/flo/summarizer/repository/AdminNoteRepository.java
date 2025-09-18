package com.flo.summarizer.repository;

import com.flo.summarizer.model.AdminNote;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Repository interface for AdminNote entities
 * Built with Spring Data JPA and Java 21
 */
@Repository
public interface AdminNoteRepository extends JpaRepository<AdminNote, Long> {

    /**
     * Find notes by title containing the given text (case-insensitive)
     */
    List<AdminNote> findByTitleContainingIgnoreCase(String title);

    /**
     * Find notes created after a specific date
     */
    List<AdminNote> findByCreatedAtAfter(LocalDateTime date);

    /**
     * Find notes that have AI summaries
     */
    List<AdminNote> findByAiSummaryIsNotNull();

    /**
     * Find notes that don't have AI summaries
     */
    List<AdminNote> findByAiSummaryIsNull();

    /**
     * Custom query to search in both title and content
     */
    @Query("""
           SELECT n FROM AdminNote n WHERE
           LOWER(n.title) LIKE LOWER(CONCAT('%', :searchTerm, '%')) OR
           LOWER(n.content) LIKE LOWER(CONCAT('%', :searchTerm, '%'))
           """)
    List<AdminNote> searchByTitleOrContent(@Param("searchTerm") String searchTerm);

    /**
     * Count notes created today using Java 21 text blocks
     */
    @Query("""
           SELECT COUNT(n) FROM AdminNote n
           WHERE DATE(n.createdAt) = CURRENT_DATE
           """)
    long countNotesCreatedToday();
}