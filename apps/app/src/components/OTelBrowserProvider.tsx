'use client';

import { getWebAutoInstrumentations } from '@opentelemetry/auto-instrumentations-web';
import { ZoneContextManager } from '@opentelemetry/context-zone';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { resourceFromAttributes } from '@opentelemetry/resources';
import {
  BatchSpanProcessor,
  WebTracerProvider,
} from '@opentelemetry/sdk-trace-web';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';
import { useEffect, useRef } from 'react';

/**
 * Client-side OpenTelemetry provider that initializes browser tracing.
 * Captures fetch/XHR calls, user interactions, and page navigations.
 * Traces are sent to /api/otel/traces which proxies them to the OTel provider.
 */
export function OTelBrowserProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) {
      return;
    }
    initialized.current = true;

    initOTelBrowser();
  }, []);

  return children;
}

function initOTelBrowser() {
  try {
    const resource = resourceFromAttributes({
      [ATTR_SERVICE_NAME]: 'common-browser',
    });

    const exporter = new OTLPTraceExporter({
      url: '/api/otel/traces',
    });

    const provider = new WebTracerProvider({
      resource,
      spanProcessors: [new BatchSpanProcessor(exporter)],
    });

    provider.register({
      contextManager: new ZoneContextManager(),
    });

    registerInstrumentations({
      instrumentations: [
        getWebAutoInstrumentations({
          '@opentelemetry/instrumentation-user-interaction': {
            eventNames: ['click', 'submit'],
          },
        }),
      ],
    });

    // Flush pending traces when user navigates away or switches tabs
    // This reduces trace loss from the batch processor
    window.addEventListener('pagehide', () => {
      provider.forceFlush();
    });

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        provider.forceFlush();
      }
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn('[OTel] Failed to initialize browser tracing:', error);
  }
}
