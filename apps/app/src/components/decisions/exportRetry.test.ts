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
    ).toBe('recovered');
  });

  it('stays quiet for a failed run, which the failure effect already toasts', () => {
    expect(
      resolveExportRetryOutcome({ errored: false, status: 'failed' }),
    ).toBe('failure-already-reported');
  });

  it('retires an export the server answered for and does not have', () => {
    expect(
      resolveExportRetryOutcome({ errored: false, status: 'not_found' }),
    ).toBe('record-gone');
  });

  it('keeps the export id when the read itself failed', () => {
    // This pins the regression. A request error once looked the same as an
    // answered `not_found`, so one unreachable cache retired a finished export
    // for good.
    expect(
      resolveExportRetryOutcome({ errored: true, status: 'not_found' }),
    ).toBe('still-unavailable');
  });

  it('keeps the export id when a completed record still has no URL', () => {
    // The signing call failed for a moment. The object remains in the bucket,
    // so the next retry can succeed.
    expect(
      resolveExportRetryOutcome({ errored: false, status: 'completed' }),
    ).toBe('still-unavailable');
  });

  it.each(['pending', 'processing'] as const)(
    'keeps the export id for a record still in flight (%s)',
    (status) => {
      expect(resolveExportRetryOutcome({ errored: false, status })).toBe(
        'still-unavailable',
      );
    },
  );

  it('keeps the export id when the read returned nothing at all', () => {
    expect(resolveExportRetryOutcome({ errored: true })).toBe(
      'still-unavailable',
    );
  });

  it('does not treat a stale URL on an errored read as recovery', () => {
    // react-query returns the last good data when a refetch fails. A signed
    // URL can therefore appear on a read that did not settle.
    expect(
      resolveExportRetryOutcome({
        errored: true,
        status: 'completed',
        signedUrl: 'https://storage.example/exports/stale.csv?token=old',
      }),
    ).toBe('still-unavailable');
  });
});
