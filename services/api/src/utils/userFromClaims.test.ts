import type { JwtPayload } from '@op/supabase/lib';
import { describe, expect, it } from 'vitest';

import { userFromClaims } from './userFromClaims';

const baseClaims: JwtPayload = {
  iss: 'https://example.supabase.co/auth/v1',
  sub: '11111111-1111-1111-1111-111111111111',
  aud: 'authenticated',
  exp: 2_000_000_000,
  iat: 1_700_000_000,
  role: 'authenticated',
  aal: 'aal1',
  session_id: 'session-1',
};

describe('userFromClaims', () => {
  it('maps the standard authenticated payload onto User fields', () => {
    const user = userFromClaims({
      ...baseClaims,
      email: 'user@oneproject.org',
      phone: '+15551234567',
      app_metadata: { provider: 'email' },
      user_metadata: { full_name: 'Casey' },
      is_anonymous: false,
    });

    expect(user.id).toBe(baseClaims.sub);
    expect(user.email).toBe('user@oneproject.org');
    expect(user.phone).toBe('+15551234567');
    expect(user.app_metadata).toEqual({ provider: 'email' });
    expect(user.user_metadata).toEqual({ full_name: 'Casey' });
    expect(user.aud).toBe('authenticated');
    expect(user.role).toBe('authenticated');
    expect(user.is_anonymous).toBe(false);
    expect(user.created_at).toBe(new Date(1_700_000_000 * 1000).toISOString());
  });

  it('preserves is_anonymous=true for anonymous sign-ins', () => {
    const user = userFromClaims({
      ...baseClaims,
      is_anonymous: true,
    });

    expect(user.is_anonymous).toBe(true);
    expect(user.email).toBeUndefined();
  });

  it('falls back to safe defaults when optional claims are missing or wrong-typed', () => {
    const user = userFromClaims({
      ...baseClaims,
      email: 42 as unknown as string,
      app_metadata: 'not-an-object' as unknown as Record<string, unknown>,
      user_metadata: ['array', 'instead'] as unknown as Record<string, unknown>,
    });

    expect(user.email).toBeUndefined();
    expect(user.app_metadata).toEqual({});
    expect(user.user_metadata).toEqual({});
  });

  it('reduces an array aud claim to its first entry', () => {
    const user = userFromClaims({
      ...baseClaims,
      aud: ['authenticated', 'other'],
    });

    expect(user.aud).toBe('authenticated');
  });
});
