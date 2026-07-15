import { ProposalFilter } from '@op/api/encoders';
import { describe, expect, it } from 'vitest';

import {
  type ProposalFilterItem,
  getRelevantProposalFilterItems,
} from './proposalFilterItems';

const allItems: ProposalFilterItem[] = [
  { id: ProposalFilter.ALL, label: 'All proposals' },
  { id: ProposalFilter.MY_PROPOSALS, label: 'My proposals' },
  { id: ProposalFilter.SHORTLISTED, label: 'Shortlisted proposals' },
  { id: ProposalFilter.MY_BALLOT, label: 'My ballot' },
];

const idsFor = (args: {
  currentFilter: ProposalFilter;
  hasOwnProposals: boolean;
  hasShortlisted: boolean;
}) =>
  getRelevantProposalFilterItems({ items: allItems, ...args }).map((i) => i.id);

describe('getRelevantProposalFilterItems', () => {
  it('drops "My proposals" and "Shortlisted" when neither is relevant', () => {
    const ids = idsFor({
      currentFilter: ProposalFilter.ALL,
      hasOwnProposals: false,
      hasShortlisted: false,
    });

    expect(ids).not.toContain(ProposalFilter.MY_PROPOSALS);
    expect(ids).not.toContain(ProposalFilter.SHORTLISTED);
  });

  it('keeps "My proposals" once the viewer has submitted one', () => {
    const ids = idsFor({
      currentFilter: ProposalFilter.ALL,
      hasOwnProposals: true,
      hasShortlisted: false,
    });

    expect(ids).toContain(ProposalFilter.MY_PROPOSALS);
    expect(ids).not.toContain(ProposalFilter.SHORTLISTED);
  });

  it('keeps "Shortlisted" once something is shortlisted', () => {
    const ids = idsFor({
      currentFilter: ProposalFilter.ALL,
      hasOwnProposals: false,
      hasShortlisted: true,
    });

    expect(ids).toContain(ProposalFilter.SHORTLISTED);
    expect(ids).not.toContain(ProposalFilter.MY_PROPOSALS);
  });

  it('always keeps the active filter so the control never strands the viewer', () => {
    const ids = idsFor({
      currentFilter: ProposalFilter.MY_PROPOSALS,
      hasOwnProposals: false,
      hasShortlisted: false,
    });

    expect(ids).toContain(ProposalFilter.MY_PROPOSALS);
  });

  it('never drops "All proposals" or "My ballot"', () => {
    const ids = idsFor({
      currentFilter: ProposalFilter.ALL,
      hasOwnProposals: false,
      hasShortlisted: false,
    });

    expect(ids).toContain(ProposalFilter.ALL);
    expect(ids).toContain(ProposalFilter.MY_BALLOT);
  });
});
