// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import messages from '../../../lib/i18n/dictionaries/en.json';
import { type AwardProposal, useProposalAwards } from '../useProposalAwards';
import { AwardCell } from './AwardCell';

const solar: AwardProposal = {
  id: 'solar',
  proposalData: {
    title: 'Solar Panel Installation',
    category: [],
    attachmentIds: [],
    budget: { amount: 12000, currency: 'USD' },
  },
};

const Harness = ({
  initiallySelected,
  onToggle,
}: {
  initiallySelected: boolean;
  onToggle?: () => void;
}) => {
  const [isSelected, setIsSelected] = useState(initiallySelected);
  const awards = useProposalAwards({
    proposals: [solar],
    selectedIds: isSelected ? ['solar'] : [],
    isEnabled: true,
  });

  return (
    <AwardCell
      proposalId="solar"
      title="Solar Panel Installation"
      awards={awards}
      isSelected={isSelected}
      onToggle={() => {
        onToggle?.();
        setIsSelected((prev) => !prev);
      }}
    />
  );
};

const renderCell = (props: {
  initiallySelected: boolean;
  onToggle?: () => void;
}) =>
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <Harness {...props} />
    </NextIntlClientProvider>,
  );

const field = () =>
  screen.getByRole('textbox', { name: 'Award for Solar Panel Installation' });

afterEach(cleanup);

describe('AwardCell', () => {
  it('starts at the requested amount with the currency as prefix and no caption', () => {
    renderCell({ initiallySelected: true });

    expect(field()).toHaveProperty('value', '12000');
    expect(screen.getByText('$')).toBeTruthy();
    expect(screen.queryByText(/^Requested/)).toBeNull();
  });

  it('shows the requested amount once the award differs and hides it when they match again', async () => {
    const user = userEvent.setup();
    renderCell({ initiallySelected: true });

    await user.clear(field());
    await user.type(field(), '3000');
    expect(screen.getByText('Requested $12,000')).toBeTruthy();

    await user.clear(field());
    await user.type(field(), '12000');
    expect(screen.queryByText('Requested $12,000')).toBeNull();
  });

  it('flags an empty award on an advanced row', async () => {
    const user = userEvent.setup();
    renderCell({ initiallySelected: true });

    await user.clear(field());

    expect(screen.getByText('Enter an amount greater than 0')).toBeTruthy();
    expect(field().getAttribute('aria-invalid')).toBe('true');
  });

  it('keeps quiet about an empty award on a row that is not advanced', async () => {
    const user = userEvent.setup();
    renderCell({ initiallySelected: false });

    await user.clear(field());

    expect(screen.queryByText('Enter an amount greater than 0')).toBeNull();
    expect(field().getAttribute('aria-invalid')).toBeNull();
  });

  it('toggles the proposal through the Advance control and keeps the typed award', async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    renderCell({ initiallySelected: false, onToggle });

    await user.clear(field());
    await user.type(field(), '9000');
    await user.click(
      screen.getByRole('button', { name: 'Advance Solar Panel Installation' }),
    );

    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(
      screen.getByRole('button', {
        name: "Don't advance Solar Panel Installation",
      }),
    ).toBeTruthy();
    expect(field()).toHaveProperty('value', '9000');
  });
});
