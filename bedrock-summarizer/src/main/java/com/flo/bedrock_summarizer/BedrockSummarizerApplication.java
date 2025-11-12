package com.flo.bedrock_summarizer;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * Main Spring Boot application for the Bedrock Summarizer Service.
 *
 * This microservice provides AI-powered summarization capabilities using AWS Bedrock
 * for admin notes and other educational content.
 */
@SpringBootApplication
public class BedrockSummarizerApplication {

    public static void main(String[] args) {
        SpringApplication.run(BedrockSummarizerApplication.class, args);
    }
}
