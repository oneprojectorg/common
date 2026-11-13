import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Locale } from '@/lib/i18n';

import LegacyDecisionCurrentPage, { generateMetadata } from './page';

const { getConvertedInstanceSlug, redirect } = vi.hoisted(() => ({
  getConvertedInstanceSlug: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock('@op/api/serverClient', () => ({
  createClient: async () => ({ decision: { getConvertedInstanceSlug } }),
}));

vi.mock('@op/logging', () => ({ logger: { error: vi.fn() } }));

vi.mock('@/lib/i18n', () => ({ redirect }));

const redirected = new Error('NEXT_REDIRECT');

const id = '7962ff89-babb-4a99-a4ed-e35d8795b416';
const locale: Locale = 'es';
const props = { params: Promise.resolve({ id, slug: 'acme', locale }) };

describe('legacy /current page', () => {
  beforeEach(() => {
    getConvertedInstanceSlug.mockReset();
    redirect.mockReset().mockImplementation(() => {
      throw redirected;
    });
  });

  it('sends a legacy instance to the legacy decision root', async () => {
    getConvertedInstanceSlug.mockResolvedValue({ slug: null });

    await expect(LegacyDecisionCurrentPage(props)).rejects.toBe(redirected);

    expect(redirect).toHaveBeenCalledExactlyOnceWith({
      href: `/profile/acme/decisions/${id}`,
      locale: 'es',
    });
  });

  it('leaves a legacy instance alone while resolving metadata', async () => {
    getConvertedInstanceSlug.mockResolvedValue({ slug: null });

    await expect(generateMetadata(props)).resolves.toEqual({});

    expect(redirect).not.toHaveBeenCalled();
  });

  it.each([
    ['the page', () => LegacyDecisionCurrentPage(props)],
    ['generateMetadata', () => generateMetadata(props)],
  ])(
    'sends a converted instance to its current route from %s',
    async (_source, run) => {
      getConvertedInstanceSlug.mockResolvedValue({ slug: 'riverbend-2026' });

      await expect(run()).rejects.toBe(redirected);

      expect(redirect).toHaveBeenCalledExactlyOnceWith({
        href: '/decisions/riverbend-2026/current',
        locale: 'es',
      });
    },
  );
});
