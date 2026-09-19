import type { TransactionType } from '@op/db/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ValidationError } from '../../utils';
import type { CustomFormProcessContext } from './customFormAuth';

const findMany = vi.fn();
const execute = vi.fn();
const selectLimit = vi.fn();

const selectBuilder = {
  from: () => selectBuilder,
  where: () => selectBuilder,
  for: () => selectBuilder,
  limit: () => selectLimit(),
};

const tx = {
  execute: (...args: unknown[]) => execute(...args),
  select: () => selectBuilder,
  query: {
    customForms: { findMany: (...args: unknown[]) => findMany(...args) },
  },
} as unknown as TransactionType;

// `@op/db/client` pulls in `server-only`, which Vitest can't load. The
// transaction runs its callback against the fake `tx` above.
vi.mock('@op/db/client', () => ({
  db: {
    transaction: (run: (tx: TransactionType) => unknown) => run(tx),
  },
  eq: (...args: unknown[]) => args,
}));

vi.mock('@op/db/schema', () => ({
  processInstances: { profileId: 'profile_id', instanceData: 'instance_data' },
}));

const { assertPhaseAvailable, lockProfileForms, writeWithPhaseLock } =
  await import('./phaseBinding');

const process: CustomFormProcessContext = {
  profileId: 'decision-profile',
  initialPhaseId: 'submission',
  phaseIds: ['submission', 'review', 'voting'],
};

describe('writeWithPhaseLock', () => {
  beforeEach(() => {
    findMany.mockReset();
    execute.mockReset();
    selectLimit.mockReset();
    findMany.mockResolvedValue([]);
    selectLimit.mockResolvedValue([
      {
        instanceData: {
          phases: [{ phaseId: 'submission' }, { phaseId: 'voting' }],
        },
      },
    ]);
  });

  it('locks the profile and clears the phase before the write runs', async () => {
    const order: string[] = [];
    execute.mockImplementation(() => {
      order.push('lock');
    });
    selectLimit.mockImplementation(() => {
      order.push('read-phases');
      return Promise.resolve([
        { instanceData: { phases: [{ phaseId: 'voting' }] } },
      ]);
    });
    findMany.mockImplementation(() => {
      order.push('check');
      return Promise.resolve([]);
    });

    const result = await writeWithPhaseLock({
      process,
      phaseId: 'voting',
      write: async () => {
        order.push('write');
        return 'written';
      },
    });

    expect(result).toBe('written');
    expect(order).toEqual(['lock', 'read-phases', 'check', 'write']);
  });

  it('refuses a phase the process dropped after the context was resolved', async () => {
    // `process` still lists it; the row read inside the transaction does not.
    selectLimit.mockResolvedValue([
      { instanceData: { phases: [{ phaseId: 'submission' }] } },
    ]);
    const write = vi.fn();

    await expect(
      writeWithPhaseLock({ process, phaseId: 'voting', write }),
    ).rejects.toThrow(ValidationError);
    expect(write).not.toHaveBeenCalled();
  });

  it('never reaches the write when the phase is taken', async () => {
    findMany.mockResolvedValue([
      { id: 'other', schema: { 'x-phase': 'voting' } },
    ]);
    const write = vi.fn();

    await expect(
      writeWithPhaseLock({ process, phaseId: 'voting', write }),
    ).rejects.toThrow(ValidationError);
    expect(write).not.toHaveBeenCalled();
  });
});

describe('lockProfileForms', () => {
  beforeEach(() => {
    execute.mockReset();
  });

  it('takes a transaction-scoped advisory lock keyed on the profile', async () => {
    await lockProfileForms({ tx, profileId: 'decision-profile' });

    expect(execute).toHaveBeenCalledOnce();
    const [statement] = execute.mock.calls[0] ?? [];
    expect(JSON.stringify(statement)).toContain(
      'custom_forms:decision-profile',
    );
  });
});

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
