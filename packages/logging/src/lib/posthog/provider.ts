import { logs } from '@opentelemetry/api-logs';
import {
  LoggerProvider,
  BatchLogRecordProcessor,
  SimpleLogRecordProcessor,
} from '@opentelemetry/sdk-logs';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { PinoInstrumentation } from '@opentelemetry/instrumentation-pino';

// Resource attribute keys (using standard OpenTelemetry semantic conventions)
const ATTR_SERVICE_NAME = 'service.name';
const ATTR_SERVICE_VERSION = 'service.version';
const ATTR_DEPLOYMENT_ENVIRONMENT = 'deployment.environment';

export type LogsConfig = {
  /** PostHog project API key (same as used for events) */
  apiKey: string;
  /** PostHog host region. Defaults to 'eu' */
  region?: 'eu' | 'us';
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
 * Creates and configures a LoggerProvider for PostHog logs using OpenTelemetry.
 *
 * PostHog logs uses the standard OTLP protocol, so we use OpenTelemetry's
 * standard OTLP HTTP exporter to send logs.
 *
 * @see https://posthog.com/docs/logs
 */
export function createLoggerProvider(config: LogsConfig): LoggerProvider {
  const {
    apiKey,
    region = 'eu',
    serviceName = 'common',
    serviceVersion = '1.0.0',
    environment = process.env.NODE_ENV || 'development',
    immediateFlush = false,
  } = config;

  // PostHog logs endpoint based on region
  const posthogHost =
    region === 'eu' ? 'eu.i.posthog.com' : 'us.i.posthog.com';
  const logsEndpoint = `https://${posthogHost}/i/v1/logs`;

  // Create the OTLP exporter for PostHog
  const exporter = new OTLPLogExporter({
    url: logsEndpoint,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
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

// Pino instrumentation instance
let pinoInstrumentation: PinoInstrumentation | null = null;

/**
 * Initializes the global logger provider and pino instrumentation.
 * This should be called once at application startup, BEFORE creating pino loggers.
 * Registers the provider globally with OpenTelemetry so pino logs are sent automatically.
 */
export function initLogs(config: LogsConfig): LoggerProvider {
  if (loggerProviderInstance) {
    return loggerProviderInstance;
  }

  loggerProviderInstance = createLoggerProvider(config);

  // Register globally so instrumentation can access it
  logs.setGlobalLoggerProvider(loggerProviderInstance);

  // Enable pino instrumentation to auto-send logs to OTel
  if (!pinoInstrumentation) {
    pinoInstrumentation = new PinoInstrumentation({
      disableLogSending: false,
      disableLogCorrelation: false,
    });
    pinoInstrumentation.enable();
  }

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
