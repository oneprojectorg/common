import { cookies } from 'next/headers';
import 'server-only';
import { cloakSSROnlySecret } from 'ssr-only-secrets';

const SSR_SECRETS_KEY_VAR = 'SSR_SECRETS_KEY';

/**
 * Get encrypted cookies for SSR tRPC calls.
 * Reads cookies from Next.js headers and encrypts them for passing to TRPCProvider.
 *
 * @returns Promise of encrypted cookie string, or undefined if no cookies
 */
export async function getSSRCookies(): Promise<string | undefined> {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join('; ');

  if (!cookieHeader) {
    return undefined;
  }

  return cloakSSROnlySecret(cookieHeader, SSR_SECRETS_KEY_VAR);
}

/**
 * Encrypt cookies for passing from Server Component to Client Component.
 * The encrypted value can only be decrypted during SSR, not in the browser.
 *
 * @param cookies - Cookie header string (e.g., "name1=value1; name2=value2")
 * @returns Promise of encrypted cookie string that can be passed as a prop
 */
export async function encryptCookiesForSSR(cookies: string): Promise<string> {
  return cloakSSROnlySecret(cookies, SSR_SECRETS_KEY_VAR);
}
