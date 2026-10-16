import { ProcessStatus } from '@op/api/encoders';
import { describe, expect, it } from 'vitest';

import { getProcessAdminStatus } from './processAdminStatus';

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
