import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { TranslateFn } from '@/lib/i18n';

vi.mock('@op/sense/Toast', () => ({
  toast: { error: vi.fn() },
}));

vi.mock('@op/logging/client', () => ({
  logger: { error: vi.fn() },
}));

import { toast } from '@op/sense/Toast';

import { handleMutationError } from './handleMutationError';

const t = ((key: string) => key) as unknown as TranslateFn;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('handleMutationError', () => {
  it('shows a single field error from error.data.fieldErrors', () => {
    handleMutationError(
      {
        data: {
          fieldErrors: { summary: 'Proposal summary is required' },
        },
        message: 'Proposal validation failed: Proposal summary is required',
      },
      'submit',
      t,
    );

    expect(toast.error).toHaveBeenCalledWith('Proposal summary is required');
  });

  it('joins multiple field errors into a description', () => {
    handleMutationError(
      {
        data: {
          fieldErrors: {
            title: 'Proposal title is required',
            summary: 'Proposal summary is required',
          },
        },
        message: 'Proposal validation failed',
      },
      'submit',
      t,
    );

    expect(toast.error).toHaveBeenCalledWith(
      'Please fix the following issues:',
      {
        description: 'Proposal title is required, Proposal summary is required',
      },
    );
  });

  it('falls back to the generic toast when no fieldErrors are present', () => {
    handleMutationError(
      {
        data: { code: 'INTERNAL_SERVER_ERROR', httpStatus: 500 },
        message: 'Something broke',
      },
      'submit',
      t,
    );

    expect(toast.error).toHaveBeenCalledWith('Failed to submit proposal', {
      description: 'Something broke',
    });
  });

  it('uses the operation title for non-submit operations', () => {
    handleMutationError({ data: undefined, message: 'nope' }, 'update', t);

    expect(toast.error).toHaveBeenCalledWith('Failed to update proposal', {
      description: 'nope',
    });
  });
});
