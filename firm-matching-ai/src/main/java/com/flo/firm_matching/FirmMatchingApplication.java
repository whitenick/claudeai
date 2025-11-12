package com.flo.firm_matching;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * RAG-Based Firm Matching POC Application
 *
 * This application demonstrates using AWS Bedrock with Claude AI to match
 * law students with appropriate law firms based on their preferences and
 * career goals using Retrieval-Augmented Generation (RAG).
 */
@SpringBootApplication
public class FirmMatchingApplication {

    public static void main(String[] args) {
        SpringApplication.run(FirmMatchingApplication.class, args);
    }
}
