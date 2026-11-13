import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Locale } from '@/lib/i18n';

import {
  redirectConvertedDecision,
  redirectConvertedDecisionCurrent,
  redirectConvertedProposal,
  redirectConvertedProposalEdit,
} from './redirectConvertedInstance';

const { getConvertedInstanceSlug, redirect, logError } = vi.hoisted(() => ({
  getConvertedInstanceSlug: vi.fn(),
  redirect: vi.fn(),
  logError: vi.fn(),
}));

vi.mock('@op/api/serverClient', () => ({
  createClient: async () => ({ decision: { getConvertedInstanceSlug } }),
}));

vi.mock('@op/logging', () => ({ logger: { error: logError } }));

vi.mock('@/lib/i18n', () => ({ redirect }));

// The real redirect() throws to stop rendering; the helper must let that through.
const redirected = new Error('NEXT_REDIRECT');

const id = '7962ff89-babb-4a99-a4ed-e35d8795b416';
const locale: Locale = 'es';
const decision = { id, slug: 'acme', locale };
const proposal = { ...decision, profileId: 'abc' };

describe('redirectConvertedInstance', () => {
  beforeEach(() => {
    getConvertedInstanceSlug.mockReset();
    logError.mockReset();
    redirect.mockReset().mockImplementation(() => {
      throw redirected;
    });
  });

  it.each([
    ['decision root', () => redirectConvertedDecision(decision), ''],
    [
      'current phase',
      () => redirectConvertedDecisionCurrent(decision),
      '/current',
    ],
    ['proposal', () => redirectConvertedProposal(proposal), '/proposal/abc'],
    [
      'proposal edit',
      () => redirectConvertedProposalEdit(proposal),
      '/proposal/abc/edit',
    ],
  ])(
    'redirects a converted instance to its %s route',
    async (_route, run, path) => {
      getConvertedInstanceSlug.mockResolvedValue({ slug: 'riverbend-2026' });

      await expect(run()).rejects.toBe(redirected);

      expect(getConvertedInstanceSlug).toHaveBeenCalledWith({ instanceId: id });
      expect(redirect).toHaveBeenCalledExactlyOnceWith({
        href: `/decisions/riverbend-2026${path}`,
        locale: 'es',
      });
    },
  );

  it('does not redirect when the lookup returns no slug', async () => {
    getConvertedInstanceSlug.mockResolvedValue({ slug: null });

    await expect(redirectConvertedDecision(decision)).resolves.toBeUndefined();

    expect(redirect).not.toHaveBeenCalled();
  });

  it('logs and does not redirect when the lookup fails', async () => {
    const error = new Error('boom');
    getConvertedInstanceSlug.mockRejectedValue(error);

    await expect(redirectConvertedDecision(decision)).resolves.toBeUndefined();

    expect(redirect).not.toHaveBeenCalled();
    expect(logError).toHaveBeenCalledWith('Converted instance lookup failed', {
      error,
      instanceId: id,
    });
  });
});
