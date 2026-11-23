// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import messages from '../../lib/i18n/dictionaries/en.json';
import { PhaseEntryCustomForm } from './PhaseEntryCustomForm';

const useQuery = vi.fn();
const mutate = vi.fn();
let mutationOptions: { onSuccess?: () => void } = {};
let resultsLive: string | null = null;
let user: { profileId: string | null } | undefined;

vi.mock('@op/api/client', () => ({
  trpc: {
    customForm: {
      getForProfile: {
        useQuery: (...args: unknown[]) => useQuery(...args),
      },
      submit: {
        useMutation: (options: { onSuccess?: () => void }) => {
          mutationOptions = options;
          return { mutate, isPending: false };
        },
      },
    },
    useUtils: () => ({
      customForm: { getForProfile: { invalidate: vi.fn() } },
    }),
  },
}));

vi.mock('nuqs', () => ({
  useQueryState: () => [resultsLive],
}));

vi.mock('@/utils/UserProvider', () => ({
  useUser: () => ({ user }),
}));

vi.mock('./FinalPhaseSubmissionSuccessDialog', () => ({
  QUERY_PARAM: 'resultsLive',
}));

vi.mock('./proposalEditor/CustomFormModal', () => ({
  CustomFormModal: ({
    onSubmit,
    onOpenChange,
  }: {
    onSubmit: (values: Record<string, unknown>) => void;
    onOpenChange: (open: boolean) => void;
  }) => (
    <div>
      <button onClick={() => onSubmit({ answer: 'yes' })}>submit form</button>
      <button onClick={() => onOpenChange(false)}>close form</button>
    </div>
  ),
}));

const entryForm = {
  id: 'form-1',
  profileId: 'decision-profile',
  name: 'Check-in',
  schema: { type: 'object', 'x-show-on': 'entry' },
};

const renderForm = () =>
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <PhaseEntryCustomForm
        decisionProfileId="decision-profile"
        currentPhaseId="review"
        initialPhaseId="submission"
      />
    </NextIntlClientProvider>,
  );

describe('PhaseEntryCustomForm', () => {
  beforeEach(() => {
    resultsLive = null;
    user = { profileId: 'participant-profile' };
    useQuery.mockReturnValue({ data: entryForm });
    document.cookie = 'form-skipped-form-1=; path=/; max-age=0';
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('asks for the current phase entry form and opens it', () => {
    renderForm();

    expect(useQuery).toHaveBeenCalledWith(
      {
        profileId: 'decision-profile',
        phaseId: 'review',
        initialPhaseId: 'submission',
        showOn: 'entry',
      },
      { enabled: true },
    );
    expect(screen.getByRole('button', { name: 'submit form' })).toBeTruthy();
  });

  it('opens nothing for a visitor with no profile, or while the results dialog is open', () => {
    user = undefined;
    const { unmount } = renderForm();
    expect(screen.queryByRole('button', { name: 'submit form' })).toBeNull();
    unmount();

    user = { profileId: 'participant-profile' };
    resultsLive = '1';
    renderForm();
    expect(screen.queryByRole('button', { name: 'submit form' })).toBeNull();
  });

  it('opens nothing when there is no entry form to answer', () => {
    useQuery.mockReturnValue({ data: null });

    renderForm();

    expect(screen.queryByRole('button', { name: 'submit form' })).toBeNull();
  });

  it('remembers a skip in a cookie and does not open again', () => {
    const { unmount } = renderForm();

    fireEvent.click(screen.getByRole('button', { name: 'close form' }));

    expect(screen.queryByRole('button', { name: 'close form' })).toBeNull();
    expect(document.cookie).toContain('form-skipped-form-1=1');
    unmount();

    renderForm();
    expect(screen.queryByRole('button', { name: 'close form' })).toBeNull();
  });

  it("attaches the answer to the participant's own profile and closes after the submit", () => {
    renderForm();

    fireEvent.click(screen.getByRole('button', { name: 'submit form' }));

    expect(mutate).toHaveBeenCalledWith({
      customFormId: 'form-1',
      profileId: 'participant-profile',
      data: { answer: 'yes' },
    });
    expect(screen.getByRole('button', { name: 'submit form' })).toBeTruthy();

    act(() => mutationOptions.onSuccess?.());

    expect(screen.queryByRole('button', { name: 'submit form' })).toBeNull();
    expect(document.cookie).not.toContain('form-skipped-form-1=1');
  });
});
