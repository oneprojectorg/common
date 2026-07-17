'use client';

import { logger } from '@op/logging/client';
import { useEffect, useRef } from 'react';

import { setErrorSpanFlusher } from '../lib/otelErrorTracking';

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

    void initOTelBrowser();
  }, []);

  return children;
}

// The @opentelemetry/* packages are imported dynamically so they land in a
// lazy chunk loaded after hydration instead of the critical-path bundle.
async function initOTelBrowser() {
  try {
    const [
      { getWebAutoInstrumentations },
      { ZoneContextManager },
      { OTLPTraceExporter },
      { registerInstrumentations },
      { resourceFromAttributes },
      { BatchSpanProcessor, WebTracerProvider },
      { ATTR_SERVICE_NAME },
    ] = await Promise.all([
      import('@opentelemetry/auto-instrumentations-web'),
      import('@opentelemetry/context-zone'),
      import('@opentelemetry/exporter-trace-otlp-http'),
      import('@opentelemetry/instrumentation'),
      import('@opentelemetry/resources'),
      import('@opentelemetry/sdk-trace-web'),
      import('@opentelemetry/semantic-conventions'),
    ]);

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

    // Error spans (recorded via the PostHog before_send hook) flush
    // immediately — the page may unload right after an error
    setErrorSpanFlusher(() => {
      void provider.forceFlush();
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
    logger.warn('[OTel] Failed to initialize browser tracing', {
      error,
      context: 'otel_browser_init',
    });
  }
}
