// @vitest-environment jsdom
import type { Proposal } from '@op/common/client';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import messages from '../../lib/i18n/dictionaries/en.json';
import { ComposeNotificationsDialog } from './ComposeNotificationsDialog';

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

const renderDialog = ({
  proposals,
  awardsAmounts = true,
}: {
  proposals: Proposal[];
  awardsAmounts?: boolean;
}) => {
  const onConfirm = vi.fn();
  const Harness = ({ selected }: { selected: Proposal[] }) => {
    const [isOpen, setIsOpen] = useState(false);
    return (
      <ComposeNotificationsDialog
        selectedProposals={selected}
        selectedCount={selected.length}
        notSelectedCount={1}
        awardsAmounts={awardsAmounts}
        isOpen={isOpen}
        onOpenChange={setIsOpen}
        onConfirm={onConfirm}
        isSubmitting={false}
        triggerLabel="Open"
      />
    );
  };

  const withProviders = (selected: Proposal[]) => (
    <NextIntlClientProvider locale="en" messages={messages}>
      <Harness selected={selected} />
    </NextIntlClientProvider>
  );
  const { rerender } = render(withProviders(proposals));

  return {
    onConfirm,
    user: userEvent.setup(),
    /** The live selection moving under the open dialog. */
    setSelected: (selected: Proposal[]) => rerender(withProviders(selected)),
  };
};

const amountField = (title: string) =>
  within(screen.getByRole('listitem', { name: title })).getByRole('textbox', {
    name: 'Awarded amount',
  });

afterEach(cleanup);

describe('ComposeNotificationsDialog awarded amounts', () => {
  it('awards each winner its requested budget by default', async () => {
    const { onConfirm, user } = renderDialog({ proposals: [alpha, beta] });

    await user.click(screen.getByRole('button', { name: 'Open' }));
    const dialog = screen.getByRole('dialog', {
      name: 'Confirm winning proposals',
    });
    expect(within(dialog).getByText('$5,000 Awarded')).toBeTruthy();
    expect(within(dialog).getByText('$8,000 Awarded')).toBeTruthy();
    expect(within(dialog).getByText('$13,000')).toBeTruthy();

    await user.click(within(dialog).getByRole('button', { name: 'Continue' }));
    await user.click(
      screen.getByRole('button', { name: 'Send & publish results' }),
    );

    expect(onConfirm).toHaveBeenCalledWith(expect.any(Object), [
      { proposalId: 'alpha', amount: 5000 },
      { proposalId: 'beta', amount: 8000 },
    ]);
  });

  it('sends the adjusted amounts, above or below the request', async () => {
    const { onConfirm, user } = renderDialog({ proposals: [alpha, beta] });

    await user.click(screen.getByRole('button', { name: 'Open' }));
    await user.click(screen.getByRole('button', { name: 'Adjust amounts' }));
    expect(document.activeElement).toBe(amountField('Proposal Alpha'));

    await user.clear(amountField('Proposal Alpha'));
    await user.type(amountField('Proposal Alpha'), '3000');
    await user.clear(amountField('Proposal Beta'));
    await user.type(amountField('Proposal Beta'), '9000.5');
    expect(screen.getByText('$12,000.5')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.click(
      screen.getByRole('button', { name: 'Send & publish results' }),
    );

    expect(onConfirm).toHaveBeenCalledWith(expect.any(Object), [
      { proposalId: 'alpha', amount: 3000 },
      { proposalId: 'beta', amount: 9000.5 },
    ]);
  });

  it('holds the step on an empty amount and focuses it', async () => {
    const unbudgeted = proposal({ id: 'gamma', title: 'Proposal Gamma' });
    const { user } = renderDialog({ proposals: [alpha, unbudgeted] });

    await user.click(screen.getByRole('button', { name: 'Open' }));
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    expect(screen.getByText('Enter an amount greater than 0')).toBeTruthy();
    expect(document.activeElement).toBe(amountField('Proposal Gamma'));
    expect(
      screen.getByRole('dialog', { name: 'Confirm winning proposals' }),
    ).toBeTruthy();

    // Leaving adjust mode is refused too, or the error would hide with the field.
    await user.click(screen.getByRole('button', { name: 'Adjust amounts' }));
    expect(amountField('Proposal Gamma')).toBeTruthy();
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
    await user.click(
      screen.getByRole('button', { name: 'Send & publish results' }),
    );

    expect(onConfirm).toHaveBeenCalledWith(expect.any(Object), undefined);
  });

  it('keeps the edited amounts when stepping back from the notifications', async () => {
    const { user } = renderDialog({ proposals: [alpha] });

    await user.click(screen.getByRole('button', { name: 'Open' }));
    await user.click(screen.getByRole('button', { name: 'Adjust amounts' }));
    await user.clear(amountField('Proposal Alpha'));
    await user.type(amountField('Proposal Alpha'), '4200');
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.click(screen.getByRole('button', { name: 'Back' }));

    expect(
      screen.getByRole('dialog', { name: 'Confirm winning proposals' }),
    ).toBeTruthy();
    expect(amountField('Proposal Alpha')).toHaveProperty('value', '4200');
  });

  it('starts over when the dialog is reopened', async () => {
    const { user } = renderDialog({ proposals: [alpha] });

    await user.click(screen.getByRole('button', { name: 'Open' }));
    await user.click(screen.getByRole('button', { name: 'Adjust amounts' }));
    await user.clear(amountField('Proposal Alpha'));
    await user.type(amountField('Proposal Alpha'), '4200');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await user.click(screen.getByRole('button', { name: 'Open' }));

    expect(screen.getByText('$5,000 Awarded')).toBeTruthy();
    expect(
      screen.queryByRole('textbox', { name: 'Awarded amount' }),
    ).toBeNull();
  });

  it('keeps the fields open while an amount is invalid', async () => {
    const { user } = renderDialog({ proposals: [alpha] });

    await user.click(screen.getByRole('button', { name: 'Open' }));
    await user.click(screen.getByRole('button', { name: 'Adjust amounts' }));
    await user.clear(amountField('Proposal Alpha'));
    await user.click(screen.getByRole('button', { name: 'Adjust amounts' }));

    expect(screen.getByText('Enter an amount greater than 0')).toBeTruthy();
    expect(document.activeElement).toBe(amountField('Proposal Alpha'));
  });

  it('reopens the amounts when the selection changes after they were confirmed', async () => {
    const { onConfirm, user, setSelected } = renderDialog({
      proposals: [alpha],
    });

    await user.click(screen.getByRole('button', { name: 'Open' }));
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    setSelected([alpha, beta]);
    await user.click(
      screen.getByRole('button', { name: 'Send & publish results' }),
    );

    expect(onConfirm).not.toHaveBeenCalled();
    expect(
      screen.getByRole('dialog', { name: 'Confirm winning proposals' }),
    ).toBeTruthy();
    expect(screen.getByText('$8,000 Awarded')).toBeTruthy();
  });
});
