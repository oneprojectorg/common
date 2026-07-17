import { diag } from '@opentelemetry/api';
import { logs } from '@opentelemetry/api-logs';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import {
  defaultResource,
  resourceFromAttributes,
} from '@opentelemetry/resources';
import {
  BatchLogRecordProcessor,
  LoggerProvider,
  SimpleLogRecordProcessor,
} from '@opentelemetry/sdk-logs';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';
import { OTLPHttpProtoTraceExporter, registerOTel } from '@vercel/otel';
import type { Instrumentation } from 'next';

import { logger } from './logger';
import { getPosthogDistinctIdFromCookieHeader } from './posthogIdentity';

/**
 * Shared OpenTelemetry setup for the Next.js `register()` instrumentation
 * hook. Registers trace, log, and metric exporters against
 * OTEL_EXPORTER_OTLP_ENDPOINT. No-ops (except trace registration) when the
 * endpoint is unset.
 */
export function registerObservability({
  defaultServiceName,
}: {
  defaultServiceName: string;
}) {
  // Disable OTEL diagnostic logging entirely (suppresses "items to be sent" debug messages)
  diag.disable();

  const otelEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
  const headers = parseHeaders(process.env.OTEL_EXPORTER_OTLP_HEADERS);
  const isEdgeRuntime = process.env.NEXT_RUNTIME === 'edge';
  const serviceName = process.env.OTEL_SERVICE_NAME || defaultServiceName;

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
      // registerOTel only sets the resource on its own trace/metric
      // providers; without this, log records ship as `unknown_service:node`
      resource: defaultResource().merge(
        resourceFromAttributes({ [ATTR_SERVICE_NAME]: serviceName }),
      ),
    });
    logs.setGlobalLoggerProvider(loggerProvider);
  }

  // Configure trace exporter. http/protobuf is the protocol PostHog's
  // tracing docs specify (JSON is also documented as accepted).
  const traceExporter = otelEndpoint
    ? new OTLPHttpProtoTraceExporter({
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
    serviceName,
    // Don't pass logRecordProcessors - we've already set up our own LoggerProvider above
    traceExporter,
    metricReaders,
  });
}

/**
 * Next.js `onRequestError` instrumentation hook. Captures server request
 * errors (RSC renders, route handlers, Server Actions) that never pass
 * through the tRPC middleware pipeline.
 */
export const onRequestError: Instrumentation.onRequestError = async (
  error,
  request,
  context,
) => {
  // Runs outside `withLogContext`, so recover the distinct id from the request
  // cookie directly to keep these person-linked.
  const cookieHeader = Array.isArray(request.headers.cookie)
    ? request.headers.cookie.join('; ')
    : request.headers.cookie;
  const posthogDistinctId = getPosthogDistinctIdFromCookieHeader(cookieHeader);
  logger.error('Unhandled server request error', {
    ...(posthogDistinctId && { posthogDistinctId }),
    error,
    path: request.path,
    method: request.method,
    routerKind: context.routerKind,
    routePath: context.routePath,
    routeType: context.routeType,
  });
  // Flush so the record survives serverless freeze/teardown after the error response
  await logger.flush();
};

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
