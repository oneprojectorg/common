import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import { BatchLogRecordProcessor } from '@opentelemetry/sdk-logs';
import { registerOTel } from '@vercel/otel';

export function register() {
  const otlpEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
  const apiKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;

  // Only configure log export if endpoint is set
  const logRecordProcessor = otlpEndpoint
    ? new BatchLogRecordProcessor(
        new OTLPLogExporter({
          url: `${otlpEndpoint}/v1/logs`,
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
        }),
      )
    : undefined;

  registerOTel({
    serviceName: 'nextjs-app',
    logRecordProcessor,
    // Disable trace export - only using logs for now
    spanProcessors: [],
  });
}
