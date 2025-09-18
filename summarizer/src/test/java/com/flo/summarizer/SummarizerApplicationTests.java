package com.flo.summarizer;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

/**
 * Basic application context test for Java 21 Spring Boot application
 * Ensures the Spring Boot application starts correctly
 */
@SpringBootTest
@ActiveProfiles("test")
class SummarizerApplicationTests {

    @Test
    void contextLoads() {
        // This test ensures the application context loads successfully
        // with Java 21 and Spring Boot 3.3.3
    }

    @Test
    void javaVersionTest() {
        var javaVersion = Runtime.version().feature();
        assert javaVersion >= 21 : STR."Expected Java 21+, but got Java \{javaVersion}";
    }
}