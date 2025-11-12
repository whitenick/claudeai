package com.flo.bedrock_summarizer;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

/**
 * Basic application context test to verify the Spring Boot application loads correctly.
 */
@SpringBootTest
@ActiveProfiles("test")
class BedrockSummarizerApplicationTests {

    @Test
    void contextLoads() {
        // This test will pass if the application context loads successfully
    }
}
