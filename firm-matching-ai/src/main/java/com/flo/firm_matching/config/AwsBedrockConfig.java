package com.flo.firm_matching.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import software.amazon.awssdk.auth.credentials.DefaultCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.bedrockagentruntime.BedrockAgentRuntimeAsyncClient;
import software.amazon.awssdk.services.bedrockruntime.BedrockRuntimeClient;

/**
 * AWS Bedrock Configuration
 *
 * Configures AWS SDK clients for Bedrock Runtime and Bedrock Agent Runtime.
 * Uses default AWS credential chain (environment variables, ~/.aws/credentials, IAM roles, etc.)
 */
@Configuration
public class AwsBedrockConfig {

    @Value("${aws.region}")
    private String awsRegion;

    /**
     * BedrockRuntimeClient for direct model invocations
     */
    @Bean
    public BedrockRuntimeClient bedrockRuntimeClient() {
        return BedrockRuntimeClient.builder()
                .region(Region.of(awsRegion))
                .credentialsProvider(DefaultCredentialsProvider.create())
                .build();
    }

    /**
     * BedrockAgentRuntimeAsyncClient for agent invocations with RAG
     * Using async client for streaming response handling
     */
    @Bean
    public BedrockAgentRuntimeAsyncClient bedrockAgentRuntimeAsyncClient() {
        return BedrockAgentRuntimeAsyncClient.builder()
                .region(Region.of(awsRegion))
                .credentialsProvider(DefaultCredentialsProvider.create())
                .build();
    }
}
