import { describe, expect, it } from 'vitest';

import {
  EXPORT_POLL_INTERVAL_MS,
  EXPORT_POLL_TIMEOUT_MS,
  nextExportPollInterval,
} from './exportPolling';

describe('nextExportPollInterval', () => {
  it('keeps polling while the workflow is queued or running', () => {
    expect(nextExportPollInterval({ status: 'pending' })).toBe(
      EXPORT_POLL_INTERVAL_MS,
    );
    expect(nextExportPollInterval({ status: 'processing' })).toBe(
      EXPORT_POLL_INTERVAL_MS,
    );
  });

  it('polls before the first response has arrived', () => {
    expect(nextExportPollInterval(undefined)).toBe(EXPORT_POLL_INTERVAL_MS);
    expect(nextExportPollInterval(null)).toBe(EXPORT_POLL_INTERVAL_MS);
  });

  // Regression: the status record is written when the export is requested, but a
  // read can land before that write is visible. Treating the first `not_found`
  // as terminal would strand an export that is about to start — the UI would sit
  // on a dead spinner for an export that then completes fine.
  it('keeps polling on not_found rather than giving up', () => {
    expect(nextExportPollInterval({ status: 'not_found' })).toBe(
      EXPORT_POLL_INTERVAL_MS,
    );
  });

  // Regression: failing to stop on a terminal state polls a finished export
  // forever, one request every few seconds for as long as the tab stays open.
  it('stops once the export reaches a terminal state', () => {
    expect(nextExportPollInterval({ status: 'completed' })).toBe(false);
    expect(nextExportPollInterval({ status: 'failed' })).toBe(false);
  });

  // An unrecognised status is likelier to be a new in-progress state than a
  // finished one, and the timeout already bounds the wait — so keep going
  // rather than stalling on a spinner that will never resolve.
  it('keeps polling on an unrecognised status', () => {
    expect(nextExportPollInterval({ status: 'queued' })).toBe(
      EXPORT_POLL_INTERVAL_MS,
    );
  });
});

describe('poll timing', () => {
  // The timeout is the only bound on the keep-polling default above, so it has
  // to leave room for many attempts — otherwise a slow export is cut off after
  // a couple of tries.
  it('allows many attempts before giving up', () => {
    expect(EXPORT_POLL_TIMEOUT_MS / EXPORT_POLL_INTERVAL_MS).toBeGreaterThan(
      10,
    );
  });
});
