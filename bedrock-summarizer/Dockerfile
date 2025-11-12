FROM bedrock-summarizer-dev

USER root
ENV OTEL_DIR=/home/cnb

# Add OpenTelemetry Java agent for observability
ADD --chown=cnb:cnb --chmod=0644 \
  https://github.com/open-telemetry/opentelemetry-java-instrumentation/releases/latest/download/opentelemetry-javaagent.jar \
  ${OTEL_DIR}/opentelemetry-javaagent.jar

ENV JAVA_TOOL_OPTIONS="-javaagent:${OTEL_DIR}/opentelemetry-javaagent.jar"
USER cnb
