import { initLogs, shutdownLogs } from '@op/logging/otel';

export function register() {
  // Initialize OTel logging if endpoint is configured
  if (process.env.OTEL_EXPORTER_OTLP_LOGS_ENDPOINT) {
    initLogs({
      serviceName: 'api',
      serviceVersion: '1.0.0',
      immediateFlush: process.env.NODE_ENV !== 'production',
    });

    // Flush logs on process exit
    process.on('beforeExit', async () => {
      await shutdownLogs();
    });
  }
}
