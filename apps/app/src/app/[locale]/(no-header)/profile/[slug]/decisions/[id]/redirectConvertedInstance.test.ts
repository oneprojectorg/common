import { beforeEach, describe, expect, it, vi } from 'vitest';

import { redirectConvertedInstance } from './redirectConvertedInstance';

const { getConvertedInstanceSlug, redirect } = vi.hoisted(() => ({
  getConvertedInstanceSlug: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock('@op/api/serverClient', () => ({
  createClient: async () => ({ decision: { getConvertedInstanceSlug } }),
}));

vi.mock('@/lib/i18n', () => ({ redirect }));

const instanceId = '7962ff89-babb-4a99-a4ed-e35d8795b416';
const href = vi.fn((decisionSlug: string) => `/decisions/${decisionSlug}`);

describe('redirectConvertedInstance', () => {
  beforeEach(() => {
    getConvertedInstanceSlug.mockReset();
    redirect.mockReset();
    href.mockClear();
  });

  it('redirects a converted instance to the route built from its slug', async () => {
    getConvertedInstanceSlug.mockResolvedValue({ slug: 'riverbend-2026' });

    await redirectConvertedInstance({
      instanceId,
      locale: 'es',
      href: (decisionSlug) => `/decisions/${decisionSlug}/proposal/abc/edit`,
    });

    expect(getConvertedInstanceSlug).toHaveBeenCalledWith({ instanceId });
    expect(redirect).toHaveBeenCalledWith({
      href: '/decisions/riverbend-2026/proposal/abc/edit',
      locale: 'es',
    });
  });

  it('does not redirect a legacy, missing or unreadable instance', async () => {
    getConvertedInstanceSlug.mockResolvedValue({ slug: null });

    await redirectConvertedInstance({ instanceId, locale: 'en', href });

    expect(redirect).not.toHaveBeenCalled();
    expect(href).not.toHaveBeenCalled();
  });

  it('does not redirect when the lookup fails', async () => {
    getConvertedInstanceSlug.mockRejectedValue(new Error('boom'));

    await expect(
      redirectConvertedInstance({ instanceId, locale: 'en', href }),
    ).resolves.toBeUndefined();
    expect(redirect).not.toHaveBeenCalled();
  });
});
