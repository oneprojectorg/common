import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  login: vi.fn(),
  exchangeCodeForSession: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock('@op/api/serverClient', () => ({
  createClient: async () => ({ account: { login: mocks.login } }),
}));

vi.mock('@op/supabase/server', () => ({
  createSBServerClient: async () => ({
    auth: {
      exchangeCodeForSession: mocks.exchangeCodeForSession,
      signOut: mocks.signOut,
    },
  }),
}));

vi.mock('@op/logging', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

const { GET } = await import('./route');

const ORIGIN = 'http://localhost:3100';

const callbackRequest = () =>
  new NextRequest(`${ORIGIN}/api/auth/callback?code=oauth-code`);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.exchangeCodeForSession.mockResolvedValue({
    data: { user: { email: 'visitor@example.com' } },
    error: null,
  });
  mocks.signOut.mockResolvedValue({ error: null });
});

// The OAuth exchange creates the session before the invite gate runs, so the
// waitlisted branch has to drop it. `account.login` reports that outcome as a
// resolved tagged union rather than a throw, which is why this branch sits
// outside the catch and cannot be covered by the router's own tests.
describe('auth callback route: invite gate', () => {
  it('signs a waitlisted visitor out and forwards the reason code', async () => {
    mocks.login.mockResolvedValue({ ok: false, reason: 'waitlisted' });

    const response = await GET(callbackRequest());

    expect(mocks.signOut).toHaveBeenCalledTimes(1);

    const location = new URL(response.headers.get('location') ?? '');
    expect(location.pathname).toBe('/login');
    expect(location.searchParams.get('reason')).toBe('waitlisted');
    // The copy is the app's to localize — no English message travels in the URL.
    expect(location.searchParams.get('error')).toBeNull();
  });

  it('keeps the session for an admitted visitor', async () => {
    mocks.login.mockResolvedValue({ ok: true });

    const response = await GET(callbackRequest());

    expect(mocks.signOut).not.toHaveBeenCalled();

    const location = new URL(response.headers.get('location') ?? '');
    expect(location.pathname).not.toBe('/login');
    expect(location.searchParams.get('reason')).toBeNull();
  });

  it('signs the visitor out and reports an error when the gate itself fails', async () => {
    mocks.login.mockRejectedValue(new Error('database unavailable'));

    const response = await GET(callbackRequest());

    expect(mocks.signOut).toHaveBeenCalledTimes(1);

    const location = new URL(response.headers.get('location') ?? '');
    expect(location.pathname).toBe('/login');
    expect(location.searchParams.get('reason')).toBeNull();
    expect(location.searchParams.get('error')).toBe('database unavailable');
  });
});
