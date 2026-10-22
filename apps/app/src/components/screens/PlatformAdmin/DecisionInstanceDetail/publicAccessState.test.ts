import { ProcessStatus } from '@op/api/encoders';
import { describe, expect, it } from 'vitest';

import { getPublicAccessState } from './publicAccessState';

describe('getPublicAccessState', () => {
  it('reports a decision with the public grant as public', () => {
    expect(
      getPublicAccessState({
        isPublic: true,
        status: ProcessStatus.PUBLISHED,
      }),
    ).toBe('public');
  });

  it('offers the action only on a published decision', () => {
    expect(
      getPublicAccessState({
        isPublic: false,
        status: ProcessStatus.PUBLISHED,
      }),
    ).toBe('openable');
  });

  it.each([
    ProcessStatus.DRAFT,
    ProcessStatus.COMPLETED,
    ProcessStatus.CANCELLED,
  ])('withholds the action on a %s decision', (status) => {
    expect(getPublicAccessState({ isPublic: false, status })).toBe(
      'unpublished',
    );
  });

  it('withholds the action when the status is unknown', () => {
    expect(getPublicAccessState({ isPublic: false, status: null })).toBe(
      'unpublished',
    );
  });

  it('still reports public when an already-open decision is no longer published', () => {
    expect(
      getPublicAccessState({ isPublic: true, status: ProcessStatus.COMPLETED }),
    ).toBe('public');
  });
});
