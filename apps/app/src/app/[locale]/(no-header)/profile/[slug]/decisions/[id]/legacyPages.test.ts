import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Locale } from '@/lib/i18n';

import DecisionInstancePage, {
  generateMetadata as decisionMetadata,
} from './page';
import ProposalEditPage, {
  generateMetadata as proposalEditMetadata,
} from './proposal/[profileId]/edit/page';
import ProposalViewPage, {
  generateMetadata as proposalMetadata,
} from './proposal/[profileId]/page';

const helpers = vi.hoisted(() => ({
  redirectConvertedDecision: vi.fn(),
  redirectConvertedDecisionCurrent: vi.fn(),
  redirectConvertedProposal: vi.fn(),
  redirectConvertedProposalEdit: vi.fn(),
}));

const createServerUtils = vi.hoisted(() => vi.fn());

vi.mock('./redirectConvertedInstance', () => helpers);
vi.mock('@op/api/server', () => ({
  HydrationBoundary: () => null,
  createServerUtils,
  dehydrate: vi.fn(),
}));
vi.mock('@/lib/i18n', () => ({ getTranslations: vi.fn() }));
vi.mock('@/utils/ResourceErrorBoundary', () => ({
  ResourceErrorBoundary: () => null,
}));
vi.mock('@op/sense/Skeleton', () => ({ Skeleton: () => null }));
vi.mock('@/components/decisions/DecisionHeader', () => ({
  DecisionHeader: () => null,
}));
vi.mock('@/components/decisions/DecisionStateRouter', () => ({
  DecisionStateRouter: () => null,
}));
vi.mock('@/components/decisions/DecisionTranslationContext', () => ({
  DecisionTranslationProvider: () => null,
}));
vi.mock('./proposal/[profileId]/ProposalViewClient', () => ({
  LegacyProposalViewClient: () => null,
}));
vi.mock('./proposal/[profileId]/edit/ProposalEditClient', () => ({
  LegacyProposalEditClient: () => null,
}));

// Stands in for the NEXT_REDIRECT throw, so the page stops at the helper.
const redirected = new Error('NEXT_REDIRECT');

const id = '7962ff89-babb-4a99-a4ed-e35d8795b416';
const locale: Locale = 'es';
const searchParams = { category: 'parks' };
const decisionParams = { id, slug: 'acme', locale };
const proposalParams = { ...decisionParams, profileId: 'proposal-1' };

const decisionProps = {
  params: Promise.resolve(decisionParams),
  searchParams: Promise.resolve(searchParams),
};
const proposalProps = {
  params: Promise.resolve(proposalParams),
  searchParams: Promise.resolve(searchParams),
};

describe('legacy decision pages', () => {
  beforeEach(() => {
    for (const helper of Object.values(helpers)) {
      helper.mockReset().mockRejectedValue(redirected);
    }
  });

  it.each([
    [
      'decision page',
      () => DecisionInstancePage(decisionProps),
      helpers.redirectConvertedDecision,
      decisionParams,
    ],
    [
      'decision metadata',
      () => decisionMetadata(decisionProps),
      helpers.redirectConvertedDecision,
      decisionParams,
    ],
    [
      'proposal page',
      () => ProposalViewPage(proposalProps),
      helpers.redirectConvertedProposal,
      proposalParams,
    ],
    [
      'proposal metadata',
      () => proposalMetadata(proposalProps),
      helpers.redirectConvertedProposal,
      proposalParams,
    ],
    [
      'proposal edit page',
      () => ProposalEditPage(proposalProps),
      helpers.redirectConvertedProposalEdit,
      proposalParams,
    ],
    [
      'proposal edit metadata',
      () => proposalEditMetadata(proposalProps),
      helpers.redirectConvertedProposalEdit,
      proposalParams,
    ],
  ])(
    'the %s checks for a converted instance first',
    async (_source, run, helper, params) => {
      await expect(run()).rejects.toBe(redirected);

      expect(helper).toHaveBeenCalledExactlyOnceWith({
        ...params,
        searchParams,
      });
    },
  );

  it.each([
    ['decision page', () => DecisionInstancePage(decisionProps)],
    ['decision metadata', () => decisionMetadata(decisionProps)],
    ['proposal page', () => ProposalViewPage(proposalProps)],
    ['proposal metadata', () => proposalMetadata(proposalProps)],
    ['proposal edit page', () => ProposalEditPage(proposalProps)],
    ['proposal edit metadata', () => proposalEditMetadata(proposalProps)],
  ])(
    'the %s carries on for an instance that is not converted',
    async (_source, run) => {
      for (const helper of Object.values(helpers)) {
        helper.mockResolvedValue(undefined);
      }
      const fetch = vi.fn().mockResolvedValue({});
      createServerUtils.mockResolvedValue({
        queryClient: {},
        utils: {
          decision: {
            getLegacyInstance: { fetch },
            getProposal: { fetch },
            getInstance: { fetch },
          },
        },
      });

      await expect(run()).resolves.toBeDefined();
    },
  );
});
