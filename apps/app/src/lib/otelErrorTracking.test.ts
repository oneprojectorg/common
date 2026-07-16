import type { CaptureResult } from 'posthog-js';
import { describe, expect, it } from 'vitest';

import { stampExceptionWithTraceContext } from './otelErrorTracking';

function exceptionEvent(message: string): CaptureResult {
  return {
    event: '$exception',
    properties: {
      $exception_list: [{ type: 'Error', value: message }],
    },
  } as unknown as CaptureResult;
}

describe('stampExceptionWithTraceContext', () => {
  it('passes through non-exception events untouched', () => {
    const event = { event: '$pageview', properties: {} } as CaptureResult;
    expect(stampExceptionWithTraceContext(event)).toBe(event);
  });

  it('passes through a null event', () => {
    expect(stampExceptionWithTraceContext(null)).toBeNull();
  });

  it('drops the benign ResizeObserver "undelivered notifications" warning', () => {
    const event = exceptionEvent(
      'ResizeObserver loop completed with undelivered notifications.',
    );
    expect(stampExceptionWithTraceContext(event)).toBeNull();
  });

  it('drops the legacy ResizeObserver "loop limit exceeded" warning', () => {
    const event = exceptionEvent('ResizeObserver loop limit exceeded');
    expect(stampExceptionWithTraceContext(event)).toBeNull();
  });

  it('keeps real exceptions', () => {
    const event = exceptionEvent('Cannot read properties of undefined');
    expect(stampExceptionWithTraceContext(event)).toBe(event);
  });
});
