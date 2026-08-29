import {
  SpanStatusCode,
  context,
  isSpanContextValid,
  trace,
} from '@opentelemetry/api';
import type { CaptureResult } from 'posthog-js';

type TraceContextProperties = {
  trace_id: string;
  span_id: string;
};

let flushTraces: (() => void) | undefined;

/**
 * Registered by OTelBrowserProvider once the WebTracerProvider is live, so
 * error spans are exported immediately instead of waiting on the batch
 * processor (the page may unload right after an error).
 */
export function setErrorSpanFlusher(flush: () => void) {
  flushTraces = flush;
}

/**
 * posthog-js `before_send` hook: records every `$exception` event on an OTel
 * span and stamps the event with `trace_id`/`span_id`, so a PostHog error can
 * be joined to its OTel trace. Covers both autocaptured exceptions and
 * explicit `posthog.captureException` calls. No-ops (event passes through
 * unstamped) while the browser tracer provider is not yet registered.
 */
export function stampExceptionWithTraceContext(
  event: CaptureResult | null,
): CaptureResult | null {
  if (!event || event.event !== '$exception') {
    return event;
  }

  const traceContext = recordExceptionOnTrace(event);
  if (traceContext) {
    event.properties = { ...event.properties, ...traceContext };
  }

  return event;
}

function recordExceptionOnTrace(
  event: CaptureResult,
): TraceContextProperties | undefined {
  const exception = extractException(event);

  // An error inside an instrumented operation (fetch, click, page load)
  // belongs to that span; otherwise create a dedicated error span.
  const activeSpan = trace.getSpan(context.active());
  if (activeSpan && isSpanContextValid(activeSpan.spanContext())) {
    activeSpan.recordException(exception);
    const { traceId, spanId } = activeSpan.spanContext();
    flushTraces?.();
    return { trace_id: traceId, span_id: spanId };
  }

  const span = trace.getTracer('browser-errors').startSpan('browser.error');
  const spanContext = span.spanContext();
  span.recordException(exception);
  span.setStatus({ code: SpanStatusCode.ERROR, message: exception.message });
  span.end();

  if (!isSpanContextValid(spanContext)) {
    return undefined;
  }

  flushTraces?.();
  return { trace_id: spanContext.traceId, span_id: spanContext.spanId };
}

export function extractException(event: CaptureResult): {
  name: string;
  message: string;
} {
  const list: unknown = event.properties?.['$exception_list'];
  let name = 'Error';
  let message = 'Unknown error';

  if (Array.isArray(list) && list.length > 0) {
    const first: unknown = list[0];
    if (first && typeof first === 'object') {
      if ('type' in first && typeof first.type === 'string' && first.type) {
        name = first.type;
      }
      if ('value' in first && typeof first.value === 'string' && first.value) {
        message = first.value;
      }
    }
  }

  return { name, message };
}
