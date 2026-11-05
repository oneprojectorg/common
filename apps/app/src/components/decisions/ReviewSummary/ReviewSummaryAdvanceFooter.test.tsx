// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import messages from '../../../lib/i18n/dictionaries/en.json';
import type { AwardProposal } from '../useProposalAwards';
import { ReviewSummaryAdvanceFooter } from './ReviewSummaryAdvanceFooter';

const INSTANCE = 'instance-footer';
const selectionKey = (phase: string) =>
  `@op/manual-selection:${INSTANCE}:${phase}`;
const awardsKey = (phase: string) => `@op/manual-awards:${INSTANCE}:${phase}`;

const proposal: AwardProposal = {
  id: 'solar',
  proposalData: {
    title: 'Solar roof',
    budget: { amount: 5000, currency: 'USD' },
    category: [],
    attachmentIds: [],
  },
  proposalTemplate: null,
  documentContent: undefined,
};

class MemoryStorage implements Storage {
  private readonly items = new Map<string, string>();
  get length() {
    return this.items.size;
  }
  key(index: number) {
    return [...this.items.keys()][index] ?? null;
  }
  getItem(key: string) {
    return this.items.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.items.set(key, String(value));
  }
  removeItem(key: string) {
    this.items.delete(key);
  }
  clear() {
    this.items.clear();
  }
}

beforeEach(() => {
  Object.defineProperty(window, 'localStorage', {
    value: new MemoryStorage(),
    configurable: true,
  });
});

afterEach(cleanup);

const renderFooter = ({
  phaseId,
  awardsAmounts,
  processBudget,
}: {
  /** Unique per test: the draft hooks cache snapshots per key module-wide. */
  phaseId: string;
  awardsAmounts: boolean;
  processBudget?: number;
}) => {
  const user = userEvent.setup();
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <ReviewSummaryAdvanceFooter
        instanceId={INSTANCE}
        phaseId={phaseId}
        proposal={proposal}
        proposalTitle="Solar roof"
        awardsAmounts={awardsAmounts}
        processBudget={processBudget}
      />
    </NextIntlClientProvider>,
  );
  return { user };
};

const readDraft = (key: string): unknown => {
  const raw = window.localStorage.getItem(key);
  return raw === null ? null : JSON.parse(raw);
};

describe('ReviewSummaryAdvanceFooter', () => {
  it('writes an award edit to the draft the selection table reads', async () => {
    // Given the winners selection (awards collected) for a proposal
    // requesting $5,000.
    const { user } = renderFooter({
      phaseId: 'phase-award-edit',
      awardsAmounts: true,
      processBudget: 9000,
    });

    // When the admin edits the award amount at the point of decision.
    const amount = screen.getByRole('textbox', {
      name: 'Award for Solar roof',
    });
    expect(amount).toHaveProperty('value', '5000');
    await user.clear(amount);
    await user.type(amount, '3000');
    await user.tab();

    // Then the edit lands in the shared award draft, keyed like the
    // selection table's `useManualAwardDraft(instanceId, previousPhaseId)`.
    expect(readDraft(awardsKey('phase-award-edit'))).toEqual({ solar: 3000 });
  });

  it('advances the proposal into the draft the selection table reads', async () => {
    // Given the winners selection footer.
    const { user } = renderFooter({
      phaseId: 'phase-advance',
      awardsAmounts: true,
    });

    // When the admin presses the same Advance toggle the table rows use.
    await user.click(
      screen.getByRole('button', { name: 'Advance Solar roof' }),
    );

    // Then the selection draft holds the proposal for the table to consume.
    expect(readDraft(selectionKey('phase-advance'))).toEqual(['solar']);
    expect(
      screen.getByRole('button', { name: "Don't advance Solar roof" }),
    ).toBeDefined();
  });

  it('keeps the plain toggle for a mid-process selection', async () => {
    // Given a selection that only advances proposals (no awards).
    const { user } = renderFooter({
      phaseId: 'phase-plain',
      awardsAmounts: false,
    });

    // Then no award field renders.
    expect(screen.queryByRole('textbox')).toBeNull();

    // When the admin toggles the proposal.
    await user.click(screen.getByRole('button', { name: 'Advance proposal' }));

    // Then the selection draft still records it.
    expect(readDraft(selectionKey('phase-plain'))).toEqual(['solar']);
  });
});
