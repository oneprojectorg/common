import { describe, expect, it } from 'vitest';

import { resolveExportRetryOutcome } from './exportRetry';

describe('resolveExportRetryOutcome', () => {
  it('reports recovery when the re-read returns a freshly signed download', () => {
    expect(
      resolveExportRetryOutcome({
        errored: false,
        status: 'completed',
        signedUrl: 'https://storage.example/exports/proposals.csv?token=abc',
      }),
    ).toEqual({ kind: 'recovered' });
  });

  it('stays quiet for a failed run, which the failure effect already toasts', () => {
    expect(
      resolveExportRetryOutcome({ errored: false, status: 'failed' }),
    ).toEqual({ kind: 'failure-already-reported' });
  });

  it('retires an export the server answered for and does not have', () => {
    expect(
      resolveExportRetryOutcome({ errored: false, status: 'not_found' }),
    ).toEqual({ kind: 'record-gone' });
  });

  it('keeps the export id when the read itself failed', () => {
    // The regression this pins: a request error used to be indistinguishable
    // from an answered `not_found`, so one unreachable cache retired a finished
    // export permanently.
    expect(
      resolveExportRetryOutcome({ errored: true, status: 'not_found' }),
    ).toEqual({ kind: 'still-unavailable' });
  });

  it('keeps the export id when a completed record still has no URL', () => {
    // The signing call failed transiently. The object is in the bucket, so the
    // next retry can still succeed.
    expect(
      resolveExportRetryOutcome({ errored: false, status: 'completed' }),
    ).toEqual({ kind: 'still-unavailable' });
  });

  it.each(['pending', 'processing'] as const)(
    'keeps the export id for a record still in flight (%s)',
    (status) => {
      expect(resolveExportRetryOutcome({ errored: false, status })).toEqual({
        kind: 'still-unavailable',
      });
    },
  );

  it('keeps the export id when the read returned nothing at all', () => {
    expect(resolveExportRetryOutcome({ errored: true })).toEqual({
      kind: 'still-unavailable',
    });
  });

  it('does not treat a stale URL on an errored read as recovery', () => {
    // react-query hands back the last good data when a refetch fails, so a
    // signed URL can be present on a read that did not settle.
    expect(
      resolveExportRetryOutcome({
        errored: true,
        status: 'completed',
        signedUrl: 'https://storage.example/exports/stale.csv?token=old',
      }),
    ).toEqual({ kind: 'still-unavailable' });
  });
});
