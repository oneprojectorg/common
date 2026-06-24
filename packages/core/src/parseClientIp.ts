/**
 * Resolve the caller's client IP from request headers in a way that is safe
 * to use as a rate-limit key.
 *
 * The naive read — `headers.get('x-forwarded-for')` — is attacker-controlled:
 * a client can inject any value to the *left* of the real entry, which lets
 * them rotate the key per request and bypass per-IP limits entirely.
 *
 * Order of preference:
 * 1. `x-real-ip` — Vercel sets this to the resolved client IP, after its
 *    own trusted-proxy chain. When present, this is the authoritative value.
 * 2. The **rightmost** non-empty entry of `x-forwarded-for`. Standard reverse
 *    proxies append each hop to the right, so the rightmost entry is the
 *    proxy adjacent to us (i.e. the trusted boundary). Everything left of it
 *    is supplied by the client and must not be trusted.
 *
 * Returns `null` when neither header carries a usable value; callers should
 * treat that as "unable to identify caller".
 */
export const parseClientIp = (headers: Headers): string | null => {
  const realIp = headers.get('x-real-ip')?.trim();
  if (realIp) {
    return realIp;
  }

  const forwardedFor = headers.get('x-forwarded-for');
  if (!forwardedFor) {
    return null;
  }

  const entries = forwardedFor
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);

  return entries.at(-1) ?? null;
};
