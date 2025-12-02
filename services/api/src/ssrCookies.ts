import { cloakSSROnlySecret } from 'ssr-only-secrets';
import 'server-only';

/**
 * Environment variable name for the SSR secrets encryption key.
 * Generate a key by running this in your browser console:
 *
 * crypto.subtle
 *   .generateKey({ name: "AES-CBC", length: 256 }, true, ["encrypt", "decrypt"])
 *   .then((key) => crypto.subtle.exportKey("jwk", key))
 *   .then(JSON.stringify)
 *   .then(console.log);
 *
 * Then add it to your .env.local:
 * SSR_SECRETS_KEY={"alg":"A256CBC","ext":true,"k":"...","key_ops":["encrypt","decrypt"],"kty":"oct"}
 */
const SSR_SECRETS_KEY_VAR = 'SSR_SECRETS_KEY';

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
