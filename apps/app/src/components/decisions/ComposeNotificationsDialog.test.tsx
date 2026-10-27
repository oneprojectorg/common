// @vitest-environment jsdom
import type { Proposal } from '@op/common/client';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import messages from '../../lib/i18n/dictionaries/en.json';
import { ComposeNotificationsDialog } from './ComposeNotificationsDialog';
import { type AwardEdits, useProposalAwards } from './useProposalAwards';

// Only the fields the confirm dialog reads; the full Proposal is an API row.
const proposal = ({
  id,
  title,
  budget,
}: {
  id: string;
  title: string;
  budget?: { amount: number; currency: string };
}): Proposal =>
  ({
    id,
    profile: { name: title },
    proposalData: { title, ...(budget ? { budget } : {}) },
  }) as unknown as Proposal;

const alpha = proposal({
  id: 'alpha',
  title: 'Proposal Alpha',
  budget: { amount: 5000, currency: 'USD' },
});
const beta = proposal({
  id: 'beta',
  title: 'Proposal Beta',
  budget: { amount: 8000, currency: 'USD' },
});

interface HarnessState {
  selected: Proposal[];
  edits: AwardEdits;
}

const renderDialog = ({
  proposals,
  awardsAmounts = true,
  edits = {},
  processBudget,
}: {
  proposals: Proposal[];
  awardsAmounts?: boolean;
  edits?: AwardEdits;
  processBudget?: number;
}) => {
  const onConfirm = vi.fn();
  const Harness = ({ selected, edits }: HarnessState) => {
    const [isOpen, setIsOpen] = useState(false);
    const awards = useProposalAwards({
      proposals: selected,
      selectedIds: selected.map(({ id }) => id),
      isEnabled: awardsAmounts,
      processBudget,
      draft: [edits, () => {}],
    });
    return (
      <ComposeNotificationsDialog
        selectedProposals={selected}
        selectedCount={selected.length}
        notSelectedCount={1}
        awards={awardsAmounts ? awards : undefined}
        phaseName="Voting"
        isOpen={isOpen}
        onOpenChange={setIsOpen}
        onConfirm={onConfirm}
        isSubmitting={false}
        triggerLabel="Open"
      />
    );
  };

  const withProviders = (state: HarnessState) => (
    <NextIntlClientProvider locale="en" messages={messages}>
      <Harness {...state} />
    </NextIntlClientProvider>
  );
  const { rerender } = render(withProviders({ selected: proposals, edits }));

  return {
    onConfirm,
    user: userEvent.setup(),
    update: (state: Partial<HarnessState>) =>
      rerender(withProviders({ selected: proposals, edits, ...state })),
  };
};

const confirmDialog = () =>
  screen.getByRole('dialog', { name: 'Confirm winning proposals' });

afterEach(cleanup);

describe('ComposeNotificationsDialog awarded amounts', () => {
  it('awards each winner its requested budget by default', async () => {
    const { onConfirm, user } = renderDialog({ proposals: [alpha, beta] });

    await user.click(screen.getByRole('button', { name: 'Open' }));
    const dialog = confirmDialog();
    expect(within(dialog).getByText('$5,000 Awarded')).toBeTruthy();
    expect(within(dialog).getByText('$8,000 Awarded')).toBeTruthy();
    expect(within(dialog).getByText('$13,000')).toBeTruthy();
    expect(within(dialog).queryByText(/^Requested/)).toBeNull();
    expect(within(dialog).queryByRole('textbox')).toBeNull();

    await user.click(within(dialog).getByRole('button', { name: 'Continue' }));
    await user.click(screen.getByRole('button', { name: 'Send & advance' }));

    expect(onConfirm).toHaveBeenCalledWith(expect.any(Object), [
      { proposalId: 'alpha', amount: 5000 },
      { proposalId: 'beta', amount: 8000 },
    ]);
  });

  it('shows the amounts adjusted in the table with the requested total, and publishes them', async () => {
    const { onConfirm, user } = renderDialog({
      proposals: [alpha, beta],
      edits: { alpha: 3000, beta: 9000.5 },
    });

    await user.click(screen.getByRole('button', { name: 'Open' }));
    const dialog = confirmDialog();
    expect(within(dialog).getByText('$3,000 Awarded')).toBeTruthy();
    expect(within(dialog).getByText('$9,000.5 Awarded')).toBeTruthy();
    expect(within(dialog).getByText('$12,000.5')).toBeTruthy();
    expect(within(dialog).getByText('Requested $13,000')).toBeTruthy();

    await user.click(within(dialog).getByRole('button', { name: 'Continue' }));
    await user.click(screen.getByRole('button', { name: 'Send & advance' }));

    expect(onConfirm).toHaveBeenCalledWith(expect.any(Object), [
      { proposalId: 'alpha', amount: 3000 },
      { proposalId: 'beta', amount: 9000.5 },
    ]);
  });

  it('shows no total when the winners asked in different currencies', async () => {
    const euro = proposal({
      id: 'euro',
      title: 'Proposal Euro',
      budget: { amount: 4000, currency: 'EUR' },
    });
    const { user } = renderDialog({ proposals: [alpha, euro] });

    await user.click(screen.getByRole('button', { name: 'Open' }));

    expect(screen.getByText('€4,000 Awarded')).toBeTruthy();
    expect(screen.queryByText('Total awarded')).toBeNull();
  });

  it('goes straight to the notifications when the template has no budget', async () => {
    const { onConfirm, user } = renderDialog({
      proposals: [alpha],
      awardsAmounts: false,
    });

    await user.click(screen.getByRole('button', { name: 'Open' }));
    await user.click(screen.getByRole('button', { name: 'Send & advance' }));

    expect(onConfirm).toHaveBeenCalledWith(expect.any(Object), undefined);
  });

  it('returns to the summary from the notifications', async () => {
    const { user } = renderDialog({
      proposals: [alpha],
      edits: { alpha: 4200 },
    });

    await user.click(screen.getByRole('button', { name: 'Open' }));
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.click(screen.getByRole('button', { name: 'Back' }));

    expect(within(confirmDialog()).getByText('$4,200 Awarded')).toBeTruthy();
  });

  it('returns to the summary instead of publishing when the selection or an amount moved since it was read', async () => {
    const { onConfirm, user, update } = renderDialog({ proposals: [alpha] });

    await user.click(screen.getByRole('button', { name: 'Open' }));
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    update({ selected: [alpha, beta], edits: { beta: 7000 } });
    await user.click(screen.getByRole('button', { name: 'Send & advance' }));

    expect(onConfirm).not.toHaveBeenCalled();
    const dialog = confirmDialog();
    expect(within(dialog).getByText('$7,000 Awarded')).toBeTruthy();

    await user.click(within(dialog).getByRole('button', { name: 'Continue' }));
    expect(
      screen.getByRole('tab', { name: /^Advanced\s*2 proposals$/ }),
    ).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Send & advance' }));
    expect(onConfirm).toHaveBeenCalledWith(expect.any(Object), [
      { proposalId: 'alpha', amount: 5000 },
      { proposalId: 'beta', amount: 7000 },
    ]);
  });

  it('stops publishing when an award turns invalid or over budget under the open dialog', async () => {
    const { onConfirm, user, update } = renderDialog({
      proposals: [alpha, beta],
      processBudget: 13000,
    });

    await user.click(screen.getByRole('button', { name: 'Open' }));
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    update({ edits: { alpha: null } });
    expect(
      screen.getByRole('button', { name: 'Send & advance' }),
    ).toHaveProperty('disabled', true);
    expect(
      screen.getByRole('button', { name: 'Advance without notifying' }),
    ).toHaveProperty('disabled', true);

    update({ edits: { alpha: 5000.01 } });
    expect(
      screen.getByRole('button', { name: 'Send & advance' }),
    ).toHaveProperty('disabled', true);

    update({ edits: {} });
    await user.click(screen.getByRole('button', { name: 'Send & advance' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});

describe('ComposeNotificationsDialog trigger', () => {
  it('keeps the trigger disabled while the awards cannot be confirmed', () => {
    renderDialog({ proposals: [alpha], processBudget: 4999 });

    expect(screen.getByRole('button', { name: 'Open' })).toHaveProperty(
      'disabled',
      true,
    );
  });
});

describe('ComposeNotificationsDialog skip', () => {
  it('publishes the awarded amounts without notifying anyone', async () => {
    const { onConfirm, user } = renderDialog({ proposals: [alpha] });

    await user.click(screen.getByRole('button', { name: 'Open' }));
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.click(
      screen.getByRole('button', { name: 'Advance without notifying' }),
    );

    expect(onConfirm).toHaveBeenCalledWith(undefined, [
      { proposalId: 'alpha', amount: 5000 },
    ]);
  });
});

describe('ComposeNotificationsDialog notifications', () => {
  it('composes advancement notifications for the destination phase', async () => {
    const { onConfirm, user } = renderDialog({
      proposals: [alpha],
      awardsAmounts: false,
    });

    await user.click(screen.getByRole('button', { name: 'Open' }));

    expect(
      screen
        .getByRole('heading', { name: 'Advance to Voting' })
        .querySelector('bdi')?.textContent,
    ).toBe('Voting');
    expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull();
    expect(
      screen.getByRole('tab', { name: /^Advanced\s*1 proposal$/ }),
    ).toBeTruthy();
    expect(
      screen.getByRole('tab', { name: /^Not advanced\s*1 proposal$/ }),
    ).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Send & advance' }));

    expect(onConfirm).toHaveBeenCalledWith(
      {
        selected: expect.stringContaining('advanced to the {{phase}} phase'),
        notSelected: expect.stringContaining(
          'did not advance to the {{phase}} phase',
        ),
      },
      undefined,
    );
  });

  it('skips without a message, but will not send one blank', async () => {
    const { onConfirm, user } = renderDialog({
      proposals: [alpha],
      awardsAmounts: false,
    });

    await user.click(screen.getByRole('button', { name: 'Open' }));
    await user.clear(
      screen.getByRole('textbox', { name: 'Notification Message' }),
    );

    expect(
      screen.getByRole('button', { name: 'Send & advance' }),
    ).toHaveProperty('disabled', true);
    await user.click(
      screen.getByRole('button', { name: 'Advance without notifying' }),
    );

    expect(onConfirm).toHaveBeenCalledWith(undefined, undefined);
  });

  it('confirms nothing once the selection is emptied under the open dialog', async () => {
    const { user, update } = renderDialog({
      proposals: [alpha],
      awardsAmounts: false,
    });

    await user.click(screen.getByRole('button', { name: 'Open' }));
    update({ selected: [] });

    expect(
      screen.getByRole('button', { name: 'Advance without notifying' }),
    ).toHaveProperty('disabled', true);
    expect(
      screen.getByRole('button', { name: 'Send & advance' }),
    ).toHaveProperty('disabled', true);
  });
});
