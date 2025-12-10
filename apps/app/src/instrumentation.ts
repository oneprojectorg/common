import { diag } from '@opentelemetry/api';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { BatchLogRecordProcessor } from '@opentelemetry/sdk-logs';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { OTLPHttpJsonTraceExporter, registerOTel } from '@vercel/otel';

export function register() {
  // Disable OTEL diagnostic logging entirely (suppresses "items to be sent" debug messages)
  diag.disable();

  const otelEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
  const headers = parseHeaders(process.env.OTEL_EXPORTER_OTLP_HEADERS);

  // Configure log export
  const logRecordProcessors =
    // Logging doesn't currently work on edge with OTel
    process.env.NEXT_RUNTIME !== 'edge' && otelEndpoint
      ? [
          new BatchLogRecordProcessor(
            new OTLPLogExporter({
              url: `${otelEndpoint}/v1/logs`,
              headers,
            }),
          ),
        ]
      : undefined;

  // Configure trace exporter
  const traceExporter = otelEndpoint
    ? new OTLPHttpJsonTraceExporter({
        url: `${otelEndpoint}/v1/traces`,
        headers,
      })
    : undefined;

  // Configure metrics exporter
  // Use a short export interval for serverless environments
  const metricReaders = otelEndpoint
    ? [
        new PeriodicExportingMetricReader({
          exporter: new OTLPMetricExporter({
            url: `${otelEndpoint}/v1/metrics`,
            headers,
          }),
          exportIntervalMillis: 10000, // 10 seconds
        }),
      ]
    : undefined;

  registerOTel({
    serviceName: process.env.OTEL_SERVICE_NAME || 'common',
    logRecordProcessors,
    traceExporter,
    metricReaders,
  });
}

const parseHeaders = (
  headersStr: string | undefined,
): Record<string, string> | undefined => {
  if (!headersStr) {
    return undefined;
  }
  const headers: Record<string, string> = {};
  for (const pair of headersStr.split(',')) {
    const [key, value] = pair.split('=');
    if (key && value) {
      headers[key.trim()] = value.trim();
    }
  }
  return Object.keys(headers).length > 0 ? headers : undefined;
};
