'use client';

import { useEffect, useRef } from 'react';

/**
 * Client-side OpenTelemetry provider that initializes browser tracing.
 * Captures fetch/XHR calls, user interactions, and page navigations.
 * Traces are sent to /api/otel/traces which proxies them to SigNoz.
 */
export function OTelBrowserProvider({ children }: { children: React.ReactNode }) {
  const initialized = useRef(false);

  useEffect(() => {
    // Only initialize once and only in browser
    if (initialized.current || typeof window === 'undefined') {
      return;
    }
    initialized.current = true;

    // Dynamic import to avoid SSR issues with browser-only OTel packages
    void initOTelBrowser();
  }, []);

  return <>{children}</>;
}

async function initOTelBrowser() {
  try {
    const [
      { WebTracerProvider, BatchSpanProcessor },
      { OTLPTraceExporter },
      { resourceFromAttributes },
      { ATTR_SERVICE_NAME },
      { ZoneContextManager },
      { registerInstrumentations },
      { getWebAutoInstrumentations },
    ] = await Promise.all([
      import('@opentelemetry/sdk-trace-web'),
      import('@opentelemetry/exporter-trace-otlp-http'),
      import('@opentelemetry/resources'),
      import('@opentelemetry/semantic-conventions'),
      import('@opentelemetry/context-zone'),
      import('@opentelemetry/instrumentation'),
      import('@opentelemetry/auto-instrumentations-web'),
    ]);

    const resource = resourceFromAttributes({
      [ATTR_SERVICE_NAME]: 'common-browser',
    });

    // Send traces to our API route which proxies to SigNoz
    const exporter = new OTLPTraceExporter({
      url: '/api/otel/traces',
    });

    const provider = new WebTracerProvider({
      resource,
      spanProcessors: [new BatchSpanProcessor(exporter)],
    });

    // Use ZoneContextManager for proper async context propagation
    provider.register({
      contextManager: new ZoneContextManager(),
    });

    // Auto-instrument fetch, XHR, document load, and user interactions
    registerInstrumentations({
      instrumentations: [
        getWebAutoInstrumentations({
          '@opentelemetry/instrumentation-fetch': {
            propagateTraceHeaderCorsUrls: [/.*/], // Propagate trace headers to all URLs
            clearTimingResources: true,
          },
          '@opentelemetry/instrumentation-xml-http-request': {
            propagateTraceHeaderCorsUrls: [/.*/],
            clearTimingResources: true,
          },
          '@opentelemetry/instrumentation-document-load': {},
          '@opentelemetry/instrumentation-user-interaction': {
            eventNames: ['click', 'submit'],
          },
        }),
      ],
    });

    // eslint-disable-next-line no-console
    console.debug('[OTel] Browser tracing initialized');
  } catch (error) {
    // Fail silently - tracing should not break the app
    // eslint-disable-next-line no-console
    console.warn('[OTel] Failed to initialize browser tracing:', error);
  }
}
