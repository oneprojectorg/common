import { createOnRequestError } from '@axiomhq/nextjs';
import { logger } from '@op/logging';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { SimpleSpanProcessor } from '@opentelemetry/sdk-trace-node';
import { registerOTel } from '@vercel/otel';

export function register() {
  registerOTel({
    serviceName: 'nextjs-app',
    spanProcessors: [
      new SimpleSpanProcessor(
        new OTLPTraceExporter({
          url: 'https://api.axiom.co/v1/traces',
          headers: {
            Authorization: `Bearer ${process.env.AXIOM_API_TOKEN}`,
            'X-Axiom-Dataset':
              process.env.NEXT_PUBLIC_AXIOM_DATASET || 'common',
          },
        }),
      ),
    ],
  });

  // Flush Axiom logs on process exit
  process.on('beforeExit', () => {
    logger.flush().catch(console.error);
  });
}

export const onRequestError = createOnRequestError(logger);
