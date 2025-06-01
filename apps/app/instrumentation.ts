import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { SimpleSpanProcessor } from '@opentelemetry/sdk-trace-node';
import { registerOTel } from '@vercel/otel';

import { flushLogs } from '@op/logger';

export function register() {
  registerOTel({
    serviceName: 'nextjs-app',
    spanProcessors: [
      new SimpleSpanProcessor(
        new OTLPTraceExporter({
          url: 'https://api.axiom.co/v1/traces',
          headers: {
            Authorization: `Bearer ${process.env.AXIOM_API_TOKEN}`,
            'X-Axiom-Dataset': process.env.AXIOM_DATASET || 'common',
          },
        }),
      ),
    ],
  });

  // Flush Axiom logs on process exit
  process.on('beforeExit', () => {
    flushLogs().catch(console.error);
  });
}
