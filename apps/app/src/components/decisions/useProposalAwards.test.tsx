// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';

import {
  type AwardEdits,
  type AwardProposal,
  useProposalAwards,
} from './useProposalAwards';

const proposal = (
  id: string,
  budget?: { amount: number; currency: string },
): AwardProposal => ({
  id,
  proposalData: {
    title: `Proposal ${id}`,
    category: [],
    attachmentIds: [],
    ...(budget ? { budget } : {}),
  },
});

const solar = proposal('solar', { amount: 12000, currency: 'USD' });
const bike = proposal('bike', { amount: 8200, currency: 'USD' });
const garden = proposal('garden', { amount: 5500, currency: 'USD' });
const euro = proposal('euro', { amount: 4000, currency: 'EUR' });
const unbudgeted = proposal('blank');

const proposals = [solar, bike, garden];

const renderAwards = (
  options: Partial<Parameters<typeof useProposalAwards>[0]> = {},
) =>
  renderHook(
    (props: Partial<Parameters<typeof useProposalAwards>[0]>) =>
      useProposalAwards({
        proposals,
        selectedIds: ['solar', 'bike'],
        isEnabled: true,
        ...options,
        ...props,
      }),
    { initialProps: {} },
  );

describe('useProposalAwards', () => {
  it('awards every proposal its requested amount by default, selected or not', () => {
    const { result } = renderAwards();

    expect([...result.current.amounts]).toEqual([
      ['solar', 12000],
      ['bike', 8200],
      ['garden', 5500],
    ]);
    expect(result.current.hasAdjusted('solar')).toBe(false);
    expect(result.current.getCurrency('solar')).toBe('USD');
  });

  it('keeps an edit on a row that is not selected and leaves it out of the allocations', () => {
    const { result } = renderAwards();

    act(() => result.current.setAmount('garden', 4000));

    expect(result.current.amounts.get('garden')).toBe(4000);
    expect(result.current.hasAdjusted('garden')).toBe(true);
    expect(result.current.allocations()).toEqual([
      { proposalId: 'solar', amount: 12000 },
      { proposalId: 'bike', amount: 8200 },
    ]);
  });

  it('sends the adjusted amount of a selected row, above or below the request', () => {
    const { result } = renderAwards();

    act(() => {
      result.current.setAmount('solar', 3000);
      result.current.setAmount('bike', 9000.5);
    });

    expect(result.current.allocations()).toEqual([
      { proposalId: 'solar', amount: 3000 },
      { proposalId: 'bike', amount: 9000.5 },
    ]);
  });

  it('flags an empty or zero award on a selected row and blocks the confirm', () => {
    const { result } = renderAwards();

    act(() => result.current.setAmount('solar', null));
    expect(result.current.isValid('solar')).toBe(false);
    expect(result.current.invalidSelectedIds).toEqual(['solar']);
    expect(result.current.canConfirm).toBe(false);

    act(() => result.current.setAmount('solar', 0));
    expect(result.current.invalidSelectedIds).toEqual(['solar']);

    act(() => result.current.setAmount('solar', 1));
    expect(result.current.invalidSelectedIds).toEqual([]);
    expect(result.current.canConfirm).toBe(true);
  });

  it('does not block the confirm for an invalid award on a row that is not selected', () => {
    const { result } = renderAwards();

    act(() => result.current.setAmount('garden', null));

    expect(result.current.isValid('garden')).toBe(false);
    expect(result.current.invalidSelectedIds).toEqual([]);
    expect(result.current.canConfirm).toBe(true);
  });

  it('treats a selected proposal without a requested budget as invalid until an amount is typed', () => {
    const { result } = renderAwards({
      proposals: [solar, unbudgeted],
      selectedIds: ['solar', 'blank'],
    });

    expect(result.current.amounts.get('blank')).toBeNull();
    expect(result.current.invalidSelectedIds).toEqual(['blank']);

    act(() => result.current.setAmount('blank', 250));

    expect(result.current.invalidSelectedIds).toEqual([]);
    expect(result.current.allocations()).toEqual([
      { proposalId: 'solar', amount: 12000 },
      { proposalId: 'blank', amount: 250 },
    ]);
  });

  it('sums the selected awards and the selected requests in their one currency', () => {
    const { result } = renderAwards();

    expect(result.current.total).toEqual({ amount: 20200, currency: 'USD' });
    expect(result.current.totalRequested).toEqual({
      amount: 20200,
      currency: 'USD',
    });

    act(() => result.current.setAmount('solar', 10000.25));

    expect(result.current.total).toEqual({
      amount: 18200.25,
      currency: 'USD',
    });
    expect(result.current.totalRequested).toEqual({
      amount: 20200,
      currency: 'USD',
    });
  });

  it('gives no total when the selected winners asked in different currencies', () => {
    const { result } = renderAwards({
      proposals: [solar, euro],
      selectedIds: ['solar', 'euro'],
    });

    expect(result.current.total).toBeNull();
    expect(result.current.totalRequested).toBeNull();
    expect(result.current.isOverBudget).toBe(false);
  });

  it('gives no total when nothing is selected', () => {
    const { result } = renderAwards({ selectedIds: [] });

    expect(result.current.total).toBeNull();
    expect(result.current.allocations()).toEqual([]);
  });

  it('blocks the confirm once the selected awards exceed the process budget', () => {
    const { result } = renderAwards({ processBudget: 20200 });

    expect(result.current.isOverBudget).toBe(false);
    expect(result.current.canConfirm).toBe(true);

    act(() => result.current.setAmount('bike', 8200.01));

    expect(result.current.isOverBudget).toBe(true);
    expect(result.current.canConfirm).toBe(false);
  });

  it('never blocks and publishes no allocations when the process awards no amounts', () => {
    const { result } = renderAwards({ isEnabled: false, processBudget: 1 });

    act(() => result.current.setAmount('solar', null));

    expect(result.current.canConfirm).toBe(true);
    expect(result.current.isOverBudget).toBe(false);
    expect(result.current.allocations()).toBeUndefined();
  });

  it('reads and writes the draft it is given instead of its own state', () => {
    const { result } = renderHook(() => {
      const [edits, setEdits] = useState<AwardEdits>({ bike: 100 });
      const awards = useProposalAwards({
        proposals,
        selectedIds: ['solar', 'bike'],
        isEnabled: true,
        draft: [edits, setEdits],
      });
      return { awards, edits };
    });

    expect(result.current.awards.amounts.get('bike')).toBe(100);

    act(() => result.current.awards.setAmount('solar', 500));

    expect(result.current.edits).toEqual({ bike: 100, solar: 500 });
  });

  it('ignores a draft entry for a proposal that is no longer listed', () => {
    const { result } = renderHook(() =>
      useProposalAwards({
        proposals,
        selectedIds: ['solar', 'gone'],
        isEnabled: true,
        draft: [{ gone: 999 }, () => {}],
      }),
    );

    expect(result.current.amounts.has('gone')).toBe(false);
    expect(result.current.invalidSelectedIds).toEqual([]);
    expect(result.current.allocations()).toEqual([
      { proposalId: 'solar', amount: 12000 },
    ]);
  });
});
