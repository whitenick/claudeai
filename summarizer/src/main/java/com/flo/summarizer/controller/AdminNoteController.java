package com.flo.summarizer.controller;

import com.flo.summarizer.model.AdminNote;
import com.flo.summarizer.service.AdminNoteService;
import jakarta.validation.Valid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * REST Controller for Admin Notes operations
 * Built with Java 21 and Spring Boot 3.3.3
 */
@RestController
@RequestMapping("/api/admin-notes")
@CrossOrigin(origins = "*")
public class AdminNoteController {

    private static final Logger logger = LoggerFactory.getLogger(AdminNoteController.class);

    private final AdminNoteService adminNoteService;

    @Autowired
    public AdminNoteController(AdminNoteService adminNoteService) {
        this.adminNoteService = adminNoteService;
    }

    /**
     * GET /api/admin-notes - Get all admin notes
     */
    @GetMapping
    public ResponseEntity<List<AdminNote>> getAllNotes() {
        logger.info("GET /api/admin-notes - Fetching all admin notes");

        try {
            var notes = adminNoteService.getAllNotes();
            return ResponseEntity.ok(notes);
        } catch (Exception e) {
            logger.error("Error fetching admin notes", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    /**
     * GET /api/admin-notes/paginated - Get admin notes with pagination
     */
    @GetMapping("/paginated")
    public ResponseEntity<Page<AdminNote>> getAllNotesPaginated(Pageable pageable) {
        logger.info("GET /api/admin-notes/paginated - Fetching admin notes with pagination");

        try {
            var notes = adminNoteService.getAllNotes(pageable);
            return ResponseEntity.ok(notes);
        } catch (Exception e) {
            logger.error("Error fetching paginated admin notes", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    /**
     * GET /api/admin-notes/{id} - Get admin note by ID using pattern matching
     */
    @GetMapping("/{id}")
    public ResponseEntity<AdminNote> getNoteById(@PathVariable Long id) {
        logger.info("GET /api/admin-notes/{} - Fetching admin note by ID", id);

        return switch (adminNoteService.getNoteById(id)) {
            case var noteOpt when noteOpt.isPresent() -> ResponseEntity.ok(noteOpt.get());
            case var noteOpt when noteOpt.isEmpty() -> ResponseEntity.notFound().build();
        };
    }

    /**
     * POST /api/admin-notes - Create new admin note
     */
    @PostMapping
    public ResponseEntity<AdminNote> createNote(@Valid @RequestBody AdminNote note) {
        logger.info("POST /api/admin-notes - Creating new admin note: {}", note.getTitle());

        try {
            var createdNote = adminNoteService.createNote(note);
            return ResponseEntity.status(HttpStatus.CREATED).body(createdNote);
        } catch (Exception e) {
            logger.error("Error creating admin note", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    /**
     * PUT /api/admin-notes/{id} - Update admin note
     */
    @PutMapping("/{id}")
    public ResponseEntity<AdminNote> updateNote(@PathVariable Long id,
                                               @Valid @RequestBody AdminNote note) {
        logger.info("PUT /api/admin-notes/{} - Updating admin note", id);

        try {
            var updatedNote = adminNoteService.updateNote(id, note);
            return ResponseEntity.ok(updatedNote);
        } catch (RuntimeException e) {
            logger.error("Error updating admin note with ID: {}", id, e);
            return ResponseEntity.notFound().build();
        } catch (Exception e) {
            logger.error("Error updating admin note", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    /**
     * DELETE /api/admin-notes/{id} - Delete admin note using Java 21 pattern matching
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Map<String, String>> deleteNote(@PathVariable Long id) {
        logger.info("DELETE /api/admin-notes/{} - Deleting admin note", id);

        try {
            var deleted = adminNoteService.deleteNote(id);
            return switch (deleted) {
                case true -> ResponseEntity.ok(Map.of("message", "Admin note deleted successfully"));
                case false -> ResponseEntity.notFound().build();
            };
        } catch (Exception e) {
            logger.error("Error deleting admin note with ID: {}", id, e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Failed to delete admin note"));
        }
    }

    /**
     * POST /api/admin-notes/{id}/generate-summary - Generate AI summary
     */
    @PostMapping("/{id}/generate-summary")
    public ResponseEntity<AdminNote> generateSummary(@PathVariable Long id) {
        logger.info("POST /api/admin-notes/{}/generate-summary - Generating AI summary", id);

        try {
            var noteWithSummary = adminNoteService.generateSummary(id);
            return ResponseEntity.ok(noteWithSummary);
        } catch (RuntimeException e) {
            logger.error("Error generating summary for admin note with ID: {}", id, e);
            return ResponseEntity.notFound().build();
        } catch (Exception e) {
            logger.error("Error generating AI summary", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    /**
     * GET /api/admin-notes/search - Search admin notes
     */
    @GetMapping("/search")
    public ResponseEntity<List<AdminNote>> searchNotes(@RequestParam String q) {
        logger.info("GET /api/admin-notes/search?q={} - Searching admin notes", q);

        try {
            var notes = adminNoteService.searchNotes(q);
            return ResponseEntity.ok(notes);
        } catch (Exception e) {
            logger.error("Error searching admin notes", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    /**
     * GET /api/admin-notes/without-summaries - Get notes without AI summaries
     */
    @GetMapping("/without-summaries")
    public ResponseEntity<List<AdminNote>> getNotesWithoutSummaries() {
        logger.info("GET /api/admin-notes/without-summaries - Fetching notes without AI summaries");

        try {
            var notes = adminNoteService.getNotesWithoutSummaries();
            return ResponseEntity.ok(notes);
        } catch (Exception e) {
            logger.error("Error fetching notes without summaries", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    /**
     * GET /api/admin-notes/stats - Get admin notes statistics using Java 21 features
     */
    @GetMapping("/stats")
    public ResponseEntity<Map<String, Object>> getStats() {
        logger.info("GET /api/admin-notes/stats - Fetching admin notes statistics");

        try {
            var totalNotes = adminNoteService.getAllNotes().size();
            var notesWithoutSummaries = adminNoteService.getNotesWithoutSummaries().size();
            var notesCreatedToday = adminNoteService.getNotesCreatedToday();

            // Using Java 21 Map.of with modern calculations
            var stats = Map.of(
                "totalNotes", totalNotes,
                "notesWithSummaries", totalNotes - notesWithoutSummaries,
                "notesWithoutSummaries", notesWithoutSummaries,
                "notesCreatedToday", notesCreatedToday,
                "javaVersion", Runtime.version().feature(),
                "springBootVersion", "3.3.3"
            );

            return ResponseEntity.ok(stats);
        } catch (Exception e) {
            logger.error("Error fetching admin notes statistics", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }
}