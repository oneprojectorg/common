import type { CaptureResult } from 'posthog-js';
import { describe, expect, it } from 'vitest';

import { dropBenignBrowserErrors } from './benignBrowserErrors';

function exceptionEvent(type: string, value: string): CaptureResult {
  return {
    uuid: 'test-uuid',
    event: '$exception',
    properties: {
      $exception_list: [{ type, value }],
    },
  };
}

const BENIGN_MESSAGES = [
  'ResizeObserver loop completed with undelivered notifications',
  'ResizeObserver loop limit exceeded',
  'Script error.',
  'AbortError: The user aborted a request.',
  'Fetch is aborted',
  "NotFoundError: Failed to execute 'removeChild' on 'Node': The node to be removed is not a child of this node.",
  'Non-Error promise rejection captured with value: Object Not Found Matching Id:1, MethodName:update, ParamCount:4',
  "SecurityError: Permission denied to access property 'Element' on cross-origin object",
];

describe('dropBenignBrowserErrors', () => {
  it.each(BENIGN_MESSAGES)('drops benign noise: %s', (message) => {
    expect(
      dropBenignBrowserErrors(exceptionEvent('Error', message)),
    ).toBeNull();
  });

  it('passes through real $exception events', () => {
    const event = exceptionEvent(
      'TypeError',
      "Cannot read properties of undefined (reading 'id')",
    );

    expect(dropBenignBrowserErrors(event)).toBe(event);
  });

  it('passes through non-exception events untouched', () => {
    const event: CaptureResult = {
      uuid: 'test-uuid',
      event: '$pageview',
      properties: {},
    };

    expect(dropBenignBrowserErrors(event)).toBe(event);
  });

  it('passes through a null event', () => {
    expect(dropBenignBrowserErrors(null)).toBeNull();
  });
});
