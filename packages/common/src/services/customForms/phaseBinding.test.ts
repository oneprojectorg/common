import type { TransactionType } from '@op/db/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ValidationError } from '../../utils';
import type { CustomFormProcessContext } from './customFormAuth';
import { assertPhaseAvailable } from './phaseBinding';

const findMany = vi.fn();

const tx = {
  query: {
    customForms: { findMany: (...args: unknown[]) => findMany(...args) },
  },
} as unknown as TransactionType;

const process: CustomFormProcessContext = {
  profileId: 'decision-profile',
  initialPhaseId: 'submission',
  phaseIds: ['submission', 'review', 'voting'],
};

describe('assertPhaseAvailable', () => {
  beforeEach(() => {
    findMany.mockReset();
    findMany.mockResolvedValue([]);
  });

  it('accepts a configured phase that holds no form', async () => {
    await expect(
      assertPhaseAvailable({ tx, process, phaseId: 'voting' }),
    ).resolves.toBeUndefined();
  });

  it('rejects a phase the process does not have', async () => {
    await expect(
      assertPhaseAvailable({ tx, process, phaseId: 'results' }),
    ).rejects.toThrow(ValidationError);
    expect(findMany).not.toHaveBeenCalled();
  });

  it('rejects a phase another form already occupies', async () => {
    findMany.mockResolvedValue([
      { id: 'other', schema: { 'x-phase': 'voting' } },
    ]);

    await expect(
      assertPhaseAvailable({ tx, process, phaseId: 'voting' }),
    ).rejects.toThrow(ValidationError);
  });

  it('lets a form keep its own phase while being updated', async () => {
    findMany.mockResolvedValue([
      { id: 'this-form', schema: { 'x-phase': 'voting' } },
    ]);

    await expect(
      assertPhaseAvailable({
        tx,
        process,
        phaseId: 'voting',
        excludeFormId: 'this-form',
      }),
    ).resolves.toBeUndefined();
  });

  it('treats a legacy form with no x-phase as holding the initial phase', async () => {
    findMany.mockResolvedValue([{ id: 'legacy', schema: {} }]);

    await expect(
      assertPhaseAvailable({ tx, process, phaseId: 'submission' }),
    ).rejects.toThrow(ValidationError);
  });

  it('names the field so the editor can point at the phase select', async () => {
    findMany.mockResolvedValue([
      { id: 'other', schema: { 'x-phase': 'review' } },
    ]);

    await expect(
      assertPhaseAvailable({ tx, process, phaseId: 'review' }),
    ).rejects.toMatchObject({
      fieldErrors: { 'x-phase': 'Each phase can have only one form' },
    });
  });
});
