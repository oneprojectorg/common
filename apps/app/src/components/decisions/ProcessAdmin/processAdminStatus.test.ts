import { ProcessStatus } from '@op/api/encoders';
import { describe, expect, it } from 'vitest';

import { getProcessAdminStatus, isProcessOpen } from './processAdminStatus';

describe('getProcessAdminStatus', () => {
  it.each([
    [ProcessStatus.DRAFT, 'draft'],
    [ProcessStatus.PUBLISHED, 'live'],
    [ProcessStatus.COMPLETED, 'completed'],
    [ProcessStatus.CANCELLED, 'cancelled'],
  ])('maps %s to %s', (status, expected) => {
    expect(getProcessAdminStatus(status)).toBe(expected);
  });

  it('treats a missing or unknown status as a draft', () => {
    expect(getProcessAdminStatus(null)).toBe('draft');
    expect(getProcessAdminStatus(undefined)).toBe('draft');
    expect(getProcessAdminStatus('archived')).toBe('draft');
  });
});

describe('isProcessOpen', () => {
  const past = [{ startDate: '2000-01-01T00:00:00.000Z' }];
  const future = [{ startDate: '2999-01-01T00:00:00.000Z' }];

  it('keeps a draft closed, even with a past start date', () => {
    expect(isProcessOpen({ status: ProcessStatus.DRAFT, phases: past })).toBe(
      false,
    );
  });

  it('treats a process with no phases as not started', () => {
    expect(isProcessOpen({ status: ProcessStatus.PUBLISHED, phases: [] })).toBe(
      false,
    );
    expect(
      isProcessOpen({ status: ProcessStatus.PUBLISHED, phases: undefined }),
    ).toBe(false);
  });

  it('opens a live process once its first phase has started', () => {
    expect(
      isProcessOpen({ status: ProcessStatus.PUBLISHED, phases: past }),
    ).toBe(true);
    expect(
      isProcessOpen({ status: ProcessStatus.PUBLISHED, phases: future }),
    ).toBe(false);
  });

  it('keeps a completed process open', () => {
    expect(
      isProcessOpen({ status: ProcessStatus.COMPLETED, phases: past }),
    ).toBe(true);
  });
});
