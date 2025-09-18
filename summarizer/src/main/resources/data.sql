-- Sample data for development and testing
-- This file will be automatically executed by Spring Boot on startup
-- Using Java 21 and Spring Boot 3.3.3

INSERT INTO admin_notes (title, content, created_at) VALUES
('Welcome to Java 21', 'Welcome to the Flo Summarizer application built with Java 21! This demonstrates modern Java features including string templates, pattern matching, and records.', NOW()),
('Spring Boot 3.3.3 Features', 'This application uses Spring Boot 3.3.3 with Jakarta EE, providing excellent performance and modern development capabilities. The migration showcases best practices for enterprise applications.', NOW()),
('Java 21 Technical Details', 'Built with Java 21 LTS featuring string templates (STR."Hello \{name}"), pattern matching in switch expressions, and record patterns. The application demonstrates modern Java development practices.', NOW()),
('AI Summary Capabilities', 'The AI summary service uses Java 21 features to analyze content and generate intelligent summaries. It includes pattern matching for content type detection and record-based data structures.', NOW()),
('Performance and Scalability', 'Designed for high performance with Java 21''s improved garbage collection, virtual threads (when enabled), and optimized JIT compilation. The architecture supports horizontal scaling.', NOW());