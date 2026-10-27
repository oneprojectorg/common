// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import en from '../../lib/i18n/dictionaries/en.json';
import { CreateMenu } from './CreateMenu';

const { flags, push, saveWizardOrigin } = vi.hoisted(() => ({
  flags: new Map<string, boolean>(),
  push: vi.fn(),
  saveWizardOrigin: vi.fn(),
}));

vi.mock('@/hooks/useFeatureFlag', () => ({
  useFeatureFlag: (key: string) => flags.get(key) ?? false,
}));

vi.mock('@/utils/UserProvider', () => ({
  useRequiredUser: () => ({
    user: { currentProfile: { type: 'individual' } },
  }),
}));

vi.mock('@op/hooks', () => ({ useMediaQuery: () => false }));

vi.mock('@op/api/client', () => ({
  trpc: {
    useUtils: () => ({
      decision: { listProcesses: { ensureData: vi.fn() } },
      client: { decision: { createInstanceFromTemplate: { mutate: vi.fn() } } },
    }),
  },
}));

vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  useRouter: () => ({ push, refresh: vi.fn() }),
  usePathname: () => '/org/acme',
}));

vi.mock('@/components/decisions/CreateProcessWizard/wizardProgress', () => ({
  saveWizardOrigin,
}));

vi.mock('../InviteUserModal', () => ({ InviteUserModal: () => null }));

vi.mock('../Profile/ProfileDetails/CreateOrganizationModal', () => ({
  CreateOrganizationModal: () => null,
}));

const openMenu = async () => {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <NextIntlClientProvider locale="en" messages={en}>
        <CreateMenu />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );

  await userEvent.click(screen.getByRole('button', { name: 'Create' }));
  await screen.findByRole('menuitem', { name: 'Organization' });
};

const oldItem = () => screen.queryByTestId('create-decision-process');
const wizardItem = () => screen.queryByTestId('create-decision-process-wizard');

describe('CreateMenu', () => {
  beforeEach(() => {
    flags.clear();
    vi.clearAllMocks();
  });

  afterEach(cleanup);

  it('shows only the template item for create_decision_process', async () => {
    flags.set('create_decision_process', true);

    await openMenu();

    expect(oldItem()).not.toBeNull();
    expect(wizardItem()).toBeNull();
  });

  it('shows only the wizard item for new_process_admin_enabled', async () => {
    flags.set('new_process_admin_enabled', true);

    await openMenu();

    expect(oldItem()).toBeNull();
    expect(wizardItem()).not.toBeNull();
  });

  it('remembers where the wizard was opened from', async () => {
    flags.set('new_process_admin_enabled', true);

    await openMenu();
    await userEvent.click(screen.getByRole('menuitem', { name: /Alpha/ }));

    expect(saveWizardOrigin).toHaveBeenCalledWith('/org/acme');
    expect(push).toHaveBeenCalledWith('/en/decisions/new');
  });
});
