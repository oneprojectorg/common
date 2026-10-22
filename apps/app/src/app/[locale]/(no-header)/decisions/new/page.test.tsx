import { beforeEach, describe, expect, it, vi } from 'vitest';

import NewDecisionProcessPage from './page';

const { getRequiredUser, isServerFeatureEnabled, notFound } = vi.hoisted(
  () => ({
    getRequiredUser: vi.fn(),
    isServerFeatureEnabled: vi.fn<() => Promise<boolean>>(),
    notFound: vi.fn(() => {
      throw new Error('NEXT_NOT_FOUND');
    }),
  }),
);

vi.mock('@/utils/getUser', () => ({ getRequiredUser }));

vi.mock('@op/common', () => ({ isServerFeatureEnabled }));

vi.mock('next/navigation', () => ({ notFound }));

vi.mock('@/lib/i18n', () => ({ getTranslations: vi.fn() }));

vi.mock('@/components/decisions/CreateProcessWizard/CreateProcessFlow', () => ({
  CreateProcessFlow: () => null,
}));

const user = (isNetworkMember: boolean) => ({
  authUserId: 'auth-1',
  isNetworkMember,
});

describe('NewDecisionProcessPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isServerFeatureEnabled.mockResolvedValue(true);
  });

  it('is not found outside the closed network, before reading the flag', async () => {
    getRequiredUser.mockResolvedValue(user(false));

    await expect(NewDecisionProcessPage()).rejects.toThrow('NEXT_NOT_FOUND');
    expect(isServerFeatureEnabled).not.toHaveBeenCalled();
  });

  it('is not found when the flag is off', async () => {
    getRequiredUser.mockResolvedValue(user(true));
    isServerFeatureEnabled.mockResolvedValue(false);

    await expect(NewDecisionProcessPage()).rejects.toThrow('NEXT_NOT_FOUND');
    expect(isServerFeatureEnabled).toHaveBeenCalledWith({
      key: 'new_process_admin_enabled',
      distinctId: 'auth-1',
    });
  });

  it('renders the wizard for a network member with the flag on', async () => {
    getRequiredUser.mockResolvedValue(user(true));

    await expect(NewDecisionProcessPage()).resolves.toBeTruthy();
    expect(notFound).not.toHaveBeenCalled();
  });
});
