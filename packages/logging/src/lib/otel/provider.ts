import { logs } from '@opentelemetry/api-logs';
import {
  LoggerProvider,
  BatchLogRecordProcessor,
  SimpleLogRecordProcessor,
} from '@opentelemetry/sdk-logs';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';

// Resource attribute keys (using standard OpenTelemetry semantic conventions)
const ATTR_SERVICE_NAME = 'service.name';
const ATTR_SERVICE_VERSION = 'service.version';
const ATTR_DEPLOYMENT_ENVIRONMENT = 'deployment.environment';

export type LogsConfig = {
  /** OTLP endpoint URL for logs. Falls back to OTEL_EXPORTER_OTLP_LOGS_ENDPOINT env var */
  endpoint?: string;
  /** API key/token for authentication. Falls back to OTEL_EXPORTER_OTLP_HEADERS env var */
  apiKey?: string;
  /** Service name for log identification */
  serviceName?: string;
  /** Service version */
  serviceVersion?: string;
  /** Environment name (production, staging, development) */
  environment?: string;
  /** Use SimpleLogRecordProcessor instead of BatchLogRecordProcessor for immediate flushing */
  immediateFlush?: boolean;
};

let loggerProviderInstance: LoggerProvider | null = null;

/**
 * Creates and configures a LoggerProvider using OpenTelemetry OTLP protocol.
 */
export function createLoggerProvider(config: LogsConfig): LoggerProvider {
  const {
    endpoint = process.env.OTEL_EXPORTER_OTLP_LOGS_ENDPOINT,
    apiKey = process.env.OTEL_EXPORTER_OTLP_API_KEY,
    serviceName = process.env.OTEL_SERVICE_NAME || 'app',
    serviceVersion = process.env.OTEL_SERVICE_VERSION || '1.0.0',
    environment = process.env.NODE_ENV || 'development',
    immediateFlush = false,
  } = config;

  if (!endpoint) {
    throw new Error('OTel logs endpoint is required. Set OTEL_EXPORTER_OTLP_LOGS_ENDPOINT or pass endpoint in config.');
  }

  // Create the OTLP exporter
  const exporter = new OTLPLogExporter({
    url: endpoint,
    headers: apiKey
      ? {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        }
      : { 'Content-Type': 'application/json' },
  });

  // Create resource with service information
  const resource = resourceFromAttributes({
    [ATTR_SERVICE_NAME]: serviceName,
    [ATTR_SERVICE_VERSION]: serviceVersion,
    [ATTR_DEPLOYMENT_ENVIRONMENT]: environment,
  });

  // Create the processor - use SimpleLogRecordProcessor for immediate flushing
  // or BatchLogRecordProcessor for better performance in production
  const processor = immediateFlush
    ? new SimpleLogRecordProcessor(exporter)
    : new BatchLogRecordProcessor(exporter, {
        maxExportBatchSize: 50,
        scheduledDelayMillis: 5000,
        maxQueueSize: 2048,
      });

  // Create and return the LoggerProvider
  const provider = new LoggerProvider({
    resource,
  });

  provider.addLogRecordProcessor(processor);

  return provider;
}

/**
 * Initializes the global logger provider.
 * This should be called once at application startup, BEFORE creating pino loggers.
 */
export function initLogs(config: LogsConfig): LoggerProvider {
  if (loggerProviderInstance) {
    return loggerProviderInstance;
  }

  loggerProviderInstance = createLoggerProvider(config);

  // Register globally
  logs.setGlobalLoggerProvider(loggerProviderInstance);

  return loggerProviderInstance;
}

/**
 * Gets the current LoggerProvider instance.
 * Returns null if not initialized.
 */
export function getLoggerProvider(): LoggerProvider | null {
  return loggerProviderInstance;
}

/**
 * Shuts down the logger provider and flushes any pending logs.
 * Should be called when the application is shutting down.
 */
export async function shutdownLogs(): Promise<void> {
  if (loggerProviderInstance) {
    await loggerProviderInstance.shutdown();
    loggerProviderInstance = null;
  }
}
