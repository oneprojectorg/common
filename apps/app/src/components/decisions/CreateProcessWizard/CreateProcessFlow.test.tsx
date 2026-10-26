// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import en from '@/lib/i18n/dictionaries/en.json';

import { CreateProcessFlow } from './CreateProcessFlow';
import { EMPTY_ANSWERS, type WizardState } from './flow';

const { mutate, replace, push, toastError } = vi.hoisted(() => ({
  mutate: vi.fn(),
  replace: vi.fn(),
  push: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock('@op/api/client', () => ({
  trpc: {
    useUtils: () => ({
      client: { decision: { createInstance: { mutate } } },
    }),
  },
}));

vi.mock('@op/logging/client', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

vi.mock('@op/sense/Toast', () => ({
  toast: { error: toastError, success: vi.fn() },
}));

vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  useRouter: () => ({ push, replace, refresh: vi.fn() }),
  usePathname: () => '/en/decisions/new',
}));

const PROGRESS_KEY = 'create-process-wizard';
const ORIGIN_KEY = 'create-process-wizard-origin';

/** A finished grant path, parked on the name screen. */
const atNameScreen: WizardState = {
  screen: 'name',
  answers: {
    ...EMPTY_ANSWERS,
    type: 'grant',
    shape: 'single',
    grantDecision: 'rubric',
  },
};

const renderFlow = async () => {
  sessionStorage.setItem(PROGRESS_KEY, JSON.stringify(atNameScreen));
  sessionStorage.setItem(ORIGIN_KEY, '/org/acme');

  render(
    <QueryClientProvider client={new QueryClient()}>
      <NextIntlClientProvider locale="en" messages={en}>
        <CreateProcessFlow />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );

  return screen.findByLabelText('Process name');
};

const submitButton = () =>
  screen.getByRole('button', { name: 'Set up my process' });

describe('CreateProcessFlow', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(cleanup);

  it('does not create a process while the name is empty', async () => {
    const input = await renderFlow();

    fireEvent.submit(input.closest('form') as HTMLFormElement);

    expect(screen.queryByText(/Use at least/)).not.toBeNull();
    expect(mutate).not.toHaveBeenCalled();
  });

  it('opens the new process and forgets the wizard on success', async () => {
    mutate.mockResolvedValue({ slug: 'murals-2026' });
    const input = await renderFlow();

    await userEvent.type(input, 'Murals 2026');
    await userEvent.click(submitButton());

    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith('/en/decisions/murals-2026/edit'),
    );
    expect(mutate).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Murals 2026', type: 'grant' }),
    );
    expect(sessionStorage.getItem(PROGRESS_KEY)).toBeNull();
    expect(sessionStorage.getItem(ORIGIN_KEY)).toBeNull();
  });

  it('keeps the answers and says so when creation fails', async () => {
    mutate.mockRejectedValue(new Error('offline'));
    const input = await renderFlow();

    await userEvent.type(input, 'Murals 2026');
    await userEvent.click(submitButton());

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(en.shell.createDecisionError),
    );
    expect(replace).not.toHaveBeenCalled();
    expect(sessionStorage.getItem(PROGRESS_KEY)).toContain('Murals 2026');
  });

  it('returns to where the wizard was opened from on exit', async () => {
    await renderFlow();

    await userEvent.click(screen.getByRole('button', { name: 'Exit' }));

    expect(push).toHaveBeenCalledWith('/en/org/acme');
    expect(sessionStorage.getItem(ORIGIN_KEY)).toBeNull();
    expect(sessionStorage.getItem(PROGRESS_KEY)).toBeNull();
  });
});
