// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { useClaimAccount } from './useClaimAccount';

const updateUser = vi.fn(async (_attributes: unknown) => ({
  data: { user: { email: null, new_email: 'person@example.com' } },
  error: null,
}));

vi.mock('@op/api/client', () => ({
  trpc: { useUtils: () => ({}) },
}));

vi.mock('@op/supabase/client', () => ({
  createSBBrowserClient: () => ({
    auth: {
      getSession: async () => ({
        data: { session: { user: { is_anonymous: true } } },
      }),
      updateUser,
    },
  }),
}));

const SpanishLocale = ({ children }: { children: ReactNode }) => (
  <NextIntlClientProvider locale="es" messages={{}}>
    {children}
  </NextIntlClientProvider>
);

describe('useClaimAccount', () => {
  it('sends the app locale with the email change, so the code email is written in it', async () => {
    const { result } = renderHook(() => useClaimAccount(), {
      wrapper: SpanishLocale,
    });

    await expect(
      result.current.requestEmailCode('person@example.com'),
    ).resolves.toEqual({ ok: true, needsOtp: true });
    expect(updateUser).toHaveBeenCalledWith({
      email: 'person@example.com',
      data: { locale: 'es' },
    });
  });
});
