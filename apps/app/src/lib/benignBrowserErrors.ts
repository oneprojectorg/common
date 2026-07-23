import type { CaptureResult } from 'posthog-js';

import { extractException } from './otelErrorTracking';

/**
 * High-volume browser/extension "errors" that are not app bugs. They drown out
 * real errors in PostHog, so we drop them client-side before they are sent.
 * Source: the "Fix Posthog Errors" autopilot (ONE-596).
 */
const BENIGN_EXCEPTION_MESSAGE_PATTERNS = [
  // Benign, widely-known browser layout-notification noise.
  'ResizeObserver loop',
  // Cross-origin script with no actionable stack.
  'Script error.',
  // Aborted fetches on navigation/unmount.
  'The user aborted a request',
  'Fetch is aborted',
  // Browser translation extensions (e.g. Google Translate) mutating the DOM under React.
  "Failed to execute 'removeChild' on 'Node'",
  // Outlook SafeLink / email-scanner bot noise.
  'Object Not Found Matching Id',
  // rrweb (session replay) reading cross-origin iframes.
  'Permission denied to access property',
] as const;

function isBenignBrowserErrorMessage(message: string): boolean {
  return BENIGN_EXCEPTION_MESSAGE_PATTERNS.some((pattern) =>
    message.includes(pattern),
  );
}

/**
 * posthog-js `before_send` hook: drops `$exception` events whose message matches
 * known benign browser/extension noise so they never reach PostHog. Non-exception
 * events and real errors pass through unchanged.
 */
export function dropBenignBrowserErrors(
  event: CaptureResult | null,
): CaptureResult | null {
  if (!event || event.event !== '$exception') {
    return event;
  }

  const { message } = extractException(event);
  if (isBenignBrowserErrorMessage(message)) {
    return null;
  }

  return event;
}
