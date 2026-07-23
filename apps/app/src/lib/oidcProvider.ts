import type { Provider } from '@op/supabase/lib';

/**
 * GoTrue has no generic OIDC slot; these are its named providers that speak
 * OpenID Connect against a deployment-configured issuer.
 */
const OIDC_PROVIDERS = [
  'keycloak',
  'azure',
  'workos',
] as const satisfies readonly Provider[];

type OIDCProviderId = (typeof OIDC_PROVIDERS)[number];

export interface OIDCProviderConfig {
  /** Display name shown on the login button ("Continue with {name}"). */
  name: string;
  /** GoTrue provider slot the sign-in redirect goes through. */
  provider: OIDCProviderId;
}

/**
 * OIDC login is enabled by setting NEXT_PUBLIC_OIDC_PROVIDER_NAME at build
 * time; NEXT_PUBLIC_OIDC_PROVIDER optionally selects the GoTrue provider slot
 * (default keycloak). An unrecognized provider value disables the button
 * rather than redirecting users to an unintended provider endpoint.
 */
export const getOIDCProvider = (): OIDCProviderConfig | null => {
  // NEXT_PUBLIC_* reads must stay literal member expressions so Next.js can
  // inline them into the client bundle at build time.
  const name = process.env.NEXT_PUBLIC_OIDC_PROVIDER_NAME?.trim();

  if (!name) {
    return null;
  }

  const providerId = process.env.NEXT_PUBLIC_OIDC_PROVIDER?.trim();

  if (!providerId) {
    return { name, provider: 'keycloak' };
  }

  const provider = OIDC_PROVIDERS.find((id) => id === providerId);

  return provider ? { name, provider } : null;
};
