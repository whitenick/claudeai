package com.flo.summarizer.service;

import com.flo.summarizer.model.AdminNote;
import com.flo.summarizer.repository.AdminNoteRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

/**
 * Service layer for AdminNote operations
 * Built with Java 21 and Spring Boot 3.3.3
 */
@Service
@Transactional
public class AdminNoteService {

    private static final Logger logger = LoggerFactory.getLogger(AdminNoteService.class);

    private final AdminNoteRepository adminNoteRepository;
    private final AiSummaryService aiSummaryService;

    @Autowired
    public AdminNoteService(AdminNoteRepository adminNoteRepository,
                           AiSummaryService aiSummaryService) {
        this.adminNoteRepository = adminNoteRepository;
        this.aiSummaryService = aiSummaryService;
    }

    /**
     * Create a new admin note
     */
    public AdminNote createNote(AdminNote note) {
        logger.info("Creating new admin note with title: {}", note.getTitle());
        return adminNoteRepository.save(note);
    }

    /**
     * Get all admin notes with pagination
     */
    @Transactional(readOnly = true)
    public Page<AdminNote> getAllNotes(Pageable pageable) {
        logger.debug("Fetching all admin notes with pagination");
        return adminNoteRepository.findAll(pageable);
    }

    /**
     * Get all admin notes
     */
    @Transactional(readOnly = true)
    public List<AdminNote> getAllNotes() {
        logger.debug("Fetching all admin notes");
        return adminNoteRepository.findAll();
    }

    /**
     * Get admin note by ID using Java 21 switch expressions
     */
    @Transactional(readOnly = true)
    public Optional<AdminNote> getNoteById(Long id) {
        logger.debug("Fetching admin note with ID: {}", id);
        return switch (id) {
            case null -> {
                logger.warn("Attempted to fetch note with null ID");
                yield Optional.empty();
            }
            case Long noteId when noteId <= 0 -> {
                logger.warn("Attempted to fetch note with invalid ID: {}", noteId);
                yield Optional.empty();
            }
            default -> adminNoteRepository.findById(id);
        };
    }

    /**
     * Update an existing admin note
     */
    public AdminNote updateNote(Long id, AdminNote updatedNote) {
        logger.info("Updating admin note with ID: {}", id);

        return adminNoteRepository.findById(id)
                .map(existingNote -> {
                    existingNote.setTitle(updatedNote.getTitle());
                    existingNote.setContent(updatedNote.getContent());
                    return adminNoteRepository.save(existingNote);
                })
                .orElseThrow(() -> new RuntimeException(STR."Admin note not found with ID: \{id}"));
    }

    /**
     * Delete an admin note
     */
    public boolean deleteNote(Long id) {
        logger.info("Deleting admin note with ID: {}", id);

        if (adminNoteRepository.existsById(id)) {
            adminNoteRepository.deleteById(id);
            return true;
        }
        return false;
    }

    /**
     * Generate AI summary for a note
     */
    public AdminNote generateSummary(Long id) {
        logger.info("Generating AI summary for note with ID: {}", id);

        return adminNoteRepository.findById(id)
                .map(note -> {
                    var summary = aiSummaryService.generateSummary(note.getContent());
                    note.setAiSummary(summary);
                    return adminNoteRepository.save(note);
                })
                .orElseThrow(() -> new RuntimeException(STR."Admin note not found with ID: \{id}"));
    }

    /**
     * Search notes by title or content
     */
    @Transactional(readOnly = true)
    public List<AdminNote> searchNotes(String searchTerm) {
        logger.debug("Searching notes with term: {}", searchTerm);
        return adminNoteRepository.searchByTitleOrContent(searchTerm);
    }

    /**
     * Get notes that need AI summaries
     */
    @Transactional(readOnly = true)
    public List<AdminNote> getNotesWithoutSummaries() {
        logger.debug("Fetching notes without AI summaries");
        return adminNoteRepository.findByAiSummaryIsNull();
    }

    /**
     * Get count of notes created today
     */
    @Transactional(readOnly = true)
    public long getNotesCreatedToday() {
        return adminNoteRepository.countNotesCreatedToday();
    }
}