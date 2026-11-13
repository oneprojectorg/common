import { beforeEach, describe, expect, it, vi } from 'vitest';

import { loadProcessAdmin } from './loadProcessAdmin';

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  assertWalledGardenAccess: vi.fn(),
  loadDecision: vi.fn(),
  isServerFeatureEnabled: vi.fn(),
}));

vi.mock('@/utils/getUser', () => ({
  getUser: mocks.getUser,
}));
vi.mock('@/utils/walledGarden', () => ({
  assertWalledGardenAccess: mocks.assertWalledGardenAccess,
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

const decisionFor = (admin: boolean) => ({
  decisionProfile: {
    name: 'Budget 2027',
    processInstance: { access: { admin } },
  },
  instanceId: 'instance-1',
  ownerSlug: 'owner',
});

describe('loadProcessAdmin', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.getUser.mockResolvedValue(user);
    mocks.assertWalledGardenAccess.mockResolvedValue(user);
  });

  it('admits any real account through the walled-garden gate', async () => {
    mocks.loadDecision.mockResolvedValue(decisionFor(true));
    mocks.isServerFeatureEnabled.mockResolvedValue(true);

    await loadProcessAdmin('budget');

    expect(mocks.assertWalledGardenAccess).toHaveBeenCalledWith(user, {
      allowNonMembers: true,
    });
  });

  it('sends a visitor without an account to login before loading the decision', async () => {
    mocks.assertWalledGardenAccess.mockRejectedValue(new Error('LOGIN'));

    await expect(loadProcessAdmin('budget')).rejects.toThrow('LOGIN');
    expect(mocks.loadDecision).not.toHaveBeenCalled();
  });

  it('passes a decision load failure through without reading the flag', async () => {
    const failure = new Error('DECISION_FORBIDDEN');
    mocks.loadDecision.mockRejectedValue(failure);

    await expect(loadProcessAdmin('budget')).rejects.toBe(failure);
    expect(mocks.isServerFeatureEnabled).not.toHaveBeenCalled();
  });

  it.each([
    ['access.admin is false', { access: { admin: false } }],
    ['access is missing', {}],
  ])('forbids without reading the flag when %s', async (_, processInstance) => {
    mocks.loadDecision.mockResolvedValue({
      decisionProfile: { name: 'Budget 2027', processInstance },
    });

    await expect(loadProcessAdmin('budget')).rejects.toThrow('FORBIDDEN');
    expect(mocks.isServerFeatureEnabled).not.toHaveBeenCalled();
  });

  it('returns not found for an admin with the flag off', async () => {
    mocks.loadDecision.mockResolvedValue(decisionFor(true));
    mocks.isServerFeatureEnabled.mockResolvedValue(false);

    await expect(loadProcessAdmin('budget')).rejects.toThrow('NOT_FOUND');
    expect(mocks.isServerFeatureEnabled).toHaveBeenCalledWith({
      key: 'new_process_admin_enabled',
      distinctId: 'auth-user-1',
    });
  });

  it('returns the decision for an admin with the flag on', async () => {
    const decision = decisionFor(true);
    mocks.loadDecision.mockResolvedValue(decision);
    mocks.isServerFeatureEnabled.mockResolvedValue(true);

    await expect(loadProcessAdmin('budget')).resolves.toBe(decision);
  });
});
