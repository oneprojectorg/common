import { diag } from '@opentelemetry/api';
import { logs } from '@opentelemetry/api-logs';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import {
  BatchLogRecordProcessor,
  LoggerProvider,
  SimpleLogRecordProcessor,
} from '@opentelemetry/sdk-logs';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { OTLPHttpJsonTraceExporter, registerOTel } from '@vercel/otel';

export function register() {
  // Disable OTEL diagnostic logging entirely (suppresses "items to be sent" debug messages)
  diag.disable();

  const otelEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
  const headers = parseHeaders(process.env.OTEL_EXPORTER_OTLP_HEADERS);
  const isEdgeRuntime = process.env.NEXT_RUNTIME === 'edge';

  // Configure log export with edge runtime workaround
  // See: https://github.com/vercel/otel/issues/104
  // The workaround is to create our own LoggerProvider with empty logRecordLimits
  // to avoid "Cannot read properties of undefined (reading 'attributeCountLimit')" error
  if (otelEndpoint) {
    const logExporter = new OTLPLogExporter({
      url: `${otelEndpoint}/v1/logs`,
      headers,
    });

    // Use SimpleLogRecordProcessor for edge (more compatible), BatchLogRecordProcessor for Node.js
    const logProcessor = isEdgeRuntime
      ? new SimpleLogRecordProcessor(logExporter)
      : new BatchLogRecordProcessor(logExporter);

    const loggerProvider = new LoggerProvider({
      // Empty logRecordLimits is the workaround for edge runtime bug
      logRecordLimits: {},
      processors: [logProcessor],
    });
    logs.setGlobalLoggerProvider(loggerProvider);
  }

  // Configure trace exporter
  const traceExporter = otelEndpoint
    ? new OTLPHttpJsonTraceExporter({
        url: `${otelEndpoint}/v1/traces`,
        headers,
      })
    : undefined;

  // Configure metrics exporter (metrics not supported on edge runtime)
  const metricReaders =
    otelEndpoint && !isEdgeRuntime
      ? [
          new PeriodicExportingMetricReader({
            exporter: new OTLPMetricExporter({
              url: `${otelEndpoint}/v1/metrics`,
              headers,
            }),
            exportIntervalMillis: 5000,
          }),
        ]
      : undefined;

  registerOTel({
    serviceName: process.env.OTEL_SERVICE_NAME || 'common',
    // Don't pass logRecordProcessors - we've already set up our own LoggerProvider above
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
