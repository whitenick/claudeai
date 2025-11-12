package com.flo.bedrock_summarizer.exception;

/**
 * Exception thrown when AWS Bedrock service operations fail.
 */
public class BedrockServiceException extends RuntimeException {

    public BedrockServiceException(String message) {
        super(message);
    }

    public BedrockServiceException(String message, Throwable cause) {
        super(message, cause);
    }
}
