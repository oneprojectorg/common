import { beforeEach, describe, expect, it, vi } from 'vitest';

import { loadProcessAdmin } from './loadProcessAdmin';

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  loadDecision: vi.fn(),
  isServerFeatureEnabled: vi.fn(),
}));

vi.mock('@/utils/getUser', () => ({
  getUser: mocks.getUser,
}));
vi.mock('./(decision-view)/loadDecision', () => ({
  loadDecision: mocks.loadDecision,
}));
vi.mock('@op/common', () => ({
  isServerFeatureEnabled: mocks.isServerFeatureEnabled,
}));
vi.mock('next/navigation', () => ({
  forbidden: () => {
    throw new Error('FORBIDDEN');
  },
  notFound: () => {
    throw new Error('NOT_FOUND');
  },
}));

const user = { authUserId: 'auth-user-1' };

const decisionFor = (access?: { admin: boolean }) => ({
  decisionProfile: { processInstance: { access } },
});

describe('loadProcessAdmin', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.getUser.mockResolvedValue(user);
  });

  it('forbids a visitor without a session without reading the flag', async () => {
    mocks.getUser.mockResolvedValue(null);
    mocks.loadDecision.mockResolvedValue(decisionFor({ admin: true }));

    await expect(loadProcessAdmin('budget')).rejects.toThrow('FORBIDDEN');
    expect(mocks.isServerFeatureEnabled).not.toHaveBeenCalled();
  });

  it('passes a decision load failure through without reading the flag', async () => {
    const failure = new Error('DECISION_FORBIDDEN');
    mocks.loadDecision.mockRejectedValue(failure);

    await expect(loadProcessAdmin('budget')).rejects.toBe(failure);
    expect(mocks.isServerFeatureEnabled).not.toHaveBeenCalled();
  });

  it.each([
    ['access.admin is false', { admin: false }],
    ['access is missing', undefined],
  ])('forbids without reading the flag when %s', async (_, access) => {
    mocks.loadDecision.mockResolvedValue(decisionFor(access));

    await expect(loadProcessAdmin('budget')).rejects.toThrow('FORBIDDEN');
    expect(mocks.isServerFeatureEnabled).not.toHaveBeenCalled();
  });

  it('returns not found for an admin with the flag off', async () => {
    mocks.loadDecision.mockResolvedValue(decisionFor({ admin: true }));
    mocks.isServerFeatureEnabled.mockResolvedValue(false);

    await expect(loadProcessAdmin('budget')).rejects.toThrow('NOT_FOUND');
    expect(mocks.isServerFeatureEnabled).toHaveBeenCalledWith({
      key: 'new_process_admin_enabled',
      distinctId: 'auth-user-1',
    });
  });

  it('returns the decision for an admin with the flag on', async () => {
    const decision = decisionFor({ admin: true });
    mocks.loadDecision.mockResolvedValue(decision);
    mocks.isServerFeatureEnabled.mockResolvedValue(true);

    await expect(loadProcessAdmin('budget')).resolves.toBe(decision);
  });
});
