import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import { BatchLogRecordProcessor } from '@opentelemetry/sdk-logs';
import { OTLPHttpJsonTraceExporter, registerOTel } from '@vercel/otel';

export function register() {
  const otelEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
  const headers = parseHeaders(process.env.OTEL_EXPORTER_OTLP_HEADERS);

  // Configure log export
  const logRecordProcessor =
    // Logging doesn't currently work on edge with OTel
    process.env.NEXT_RUNTIME !== 'edge' && otelEndpoint
      ? new BatchLogRecordProcessor(
          new OTLPLogExporter({
            url: `${otelEndpoint}/v1/logs`,
            headers,
          }),
        )
      : undefined;

  // Configure trace exporter
  const traceExporter = otelEndpoint
    ? new OTLPHttpJsonTraceExporter({
        url: `${otelEndpoint}/v1/traces`,
        headers,
      })
    : undefined;

  registerOTel({
    serviceName: process.env.OTEL_SERVICE_NAME || 'common',
    logRecordProcessor,
    traceExporter,
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
