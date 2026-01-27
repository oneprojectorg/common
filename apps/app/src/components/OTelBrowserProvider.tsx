'use client';

import { originUrlMatcher } from '@op/core';
import { useEffect, useRef } from 'react';

/**
 * Client-side OpenTelemetry provider that initializes browser tracing.
 * Captures fetch/XHR calls, user interactions, and page navigations.
 * Traces are sent to /api/otel/traces which proxies them to SigNoz.
 */
export function OTelBrowserProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const initialized = useRef(false);

  useEffect(() => {
    // Only initialize once
    if (initialized.current) {
      return;
    }
    initialized.current = true;

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
    // In development (localhost), propagate trace headers to all URLs (no CORS concerns)
    // In production/staging/preview, only propagate to our own domains to avoid leaking trace IDs
    const isDevelopment = window.location.hostname === 'localhost';
    const propagateUrls = isDevelopment ? [/.*/] : [originUrlMatcher];

    registerInstrumentations({
      instrumentations: [
        getWebAutoInstrumentations({
          '@opentelemetry/instrumentation-fetch': {
            propagateTraceHeaderCorsUrls: propagateUrls,
            clearTimingResources: true,
          },
          '@opentelemetry/instrumentation-xml-http-request': {
            propagateTraceHeaderCorsUrls: propagateUrls,
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
