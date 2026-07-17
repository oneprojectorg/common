import { afterEach, describe, expect, it, vi } from 'vitest';

import { getOIDCProvider } from './oidcProvider';

describe('getOIDCProvider', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns null when NEXT_PUBLIC_OIDC_PROVIDER_NAME is unset', () => {
    vi.stubEnv('NEXT_PUBLIC_OIDC_PROVIDER_NAME', '');

    expect(getOIDCProvider()).toBeNull();
  });

  it('returns null when the name is only whitespace', () => {
    vi.stubEnv('NEXT_PUBLIC_OIDC_PROVIDER_NAME', '   ');

    expect(getOIDCProvider()).toBeNull();
  });

  it('defaults the provider to keycloak when only the name is set', () => {
    vi.stubEnv('NEXT_PUBLIC_OIDC_PROVIDER_NAME', 'Acme SSO');
    vi.stubEnv('NEXT_PUBLIC_OIDC_PROVIDER', '');

    expect(getOIDCProvider()).toEqual({
      name: 'Acme SSO',
      provider: 'keycloak',
    });
  });

  it('trims the display name', () => {
    vi.stubEnv('NEXT_PUBLIC_OIDC_PROVIDER_NAME', '  Acme SSO  ');

    expect(getOIDCProvider()?.name).toBe('Acme SSO');
  });

  it('uses an allowlisted provider id', () => {
    vi.stubEnv('NEXT_PUBLIC_OIDC_PROVIDER_NAME', 'Acme SSO');
    vi.stubEnv('NEXT_PUBLIC_OIDC_PROVIDER', 'azure');

    expect(getOIDCProvider()).toEqual({ name: 'Acme SSO', provider: 'azure' });
  });

  it('disables the button for a non-allowlisted provider id', () => {
    vi.stubEnv('NEXT_PUBLIC_OIDC_PROVIDER_NAME', 'Acme SSO');
    vi.stubEnv('NEXT_PUBLIC_OIDC_PROVIDER', 'okta');

    expect(getOIDCProvider()).toBeNull();
  });
});
