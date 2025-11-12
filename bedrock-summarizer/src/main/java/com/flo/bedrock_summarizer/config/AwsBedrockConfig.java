package com.flo.bedrock_summarizer.config;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import software.amazon.awssdk.auth.credentials.DefaultCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.bedrock.BedrockClient;
import software.amazon.awssdk.services.bedrockruntime.BedrockRuntimeClient;
import software.amazon.awssdk.services.secretsmanager.SecretsManagerClient;

/**
 * AWS Bedrock configuration for AI model invocation.
 *
 * This configuration sets up the AWS SDK clients needed for:
 * - BedrockRuntimeClient: For invoking foundation models
 * - BedrockClient: For managing Bedrock resources
 * - SecretsManagerClient: For secure credential management
 */
@Configuration
@Slf4j
public class AwsBedrockConfig {

    @Value("${aws.region:us-east-1}")
    private String awsRegion;

    @Bean
    public BedrockRuntimeClient bedrockRuntimeClient() {
        log.info("Initializing BedrockRuntimeClient for region: {}", awsRegion);
        return BedrockRuntimeClient.builder()
                .region(Region.of(awsRegion))
                .credentialsProvider(DefaultCredentialsProvider.create())
                .build();
    }

    @Bean
    public BedrockClient bedrockClient() {
        log.info("Initializing BedrockClient for region: {}", awsRegion);
        return BedrockClient.builder()
                .region(Region.of(awsRegion))
                .credentialsProvider(DefaultCredentialsProvider.create())
                .build();
    }

    @Bean
    public SecretsManagerClient secretsManagerClient() {
        log.info("Initializing SecretsManagerClient for region: {}", awsRegion);
        return SecretsManagerClient.builder()
                .region(Region.of(awsRegion))
                .credentialsProvider(DefaultCredentialsProvider.create())
                .build();
    }
}
