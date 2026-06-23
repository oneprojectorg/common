// Header the legitimate client sets on every mutating tRPC request. Its
// presence forces a CORS preflight regardless of Content-Type, so a CSRF
// form post from a cross-origin page is rejected by the browser before
// it ever reaches the router. The value is fixed because we use the
// header's presence (not its contents) as the signal.
export const CSRF_HEADER = 'x-csrf-protection';
export const CSRF_HEADER_VALUE = '1';

// tRPC's httpBatchStreamLink puts every op (query OR mutation) into a
// POST. Applying the gate to every mutating method also catches batched
// queries — that's fine, the legitimate client sets the header on every
// request and the spec only worries about state-changing methods being
// forgeable via simple HTML forms.
const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export type CsrfRejectionReason =
  | 'missing-header'
  | 'origin-not-allowed'
  | 'referer-not-allowed'
  | 'invalid-referer';

export type CsrfOptions = {
  /**
   * Predicate that returns true when an Origin (or Referer-derived
   * origin) is considered same-site for our deployment. Pass a permissive
   * predicate (`() => true`) in development so localhost callers work.
   */
  isOriginAllowed: (origin: string) => boolean;
};

/**
 * Returns the rejection reason, or null when the request passes the CSRF
 * gate. The gate runs only on mutating methods; non-mutating verbs and
 * server-to-server callers (no Origin AND no Referer) pass through.
 *
 * CSRF is a browser threat model: an attacker page cannot strip the
 * Origin header from JavaScript, so when *either* Origin or Referer is
 * present we trust it. Requests with neither are non-browser callers
 * (SSR, scripts) and we let the custom-header check carry the load.
 */
export const csrfRejection = (
  req: Request,
  opts: CsrfOptions,
): CsrfRejectionReason | null => {
  if (!MUTATING_METHODS.has(req.method)) {
    return null;
  }

  if (!req.headers.has(CSRF_HEADER)) {
    return 'missing-header';
  }

  const origin = req.headers.get('origin');
  // `Origin: null` is what sandboxed iframes, file:// pages, data:
  // URIs, and similar opaque-origin contexts send. None of those are
  // legitimate callers of our API, so reject without consulting Referer.
  if (origin === 'null') {
    return 'origin-not-allowed';
  }
  if (origin) {
    return opts.isOriginAllowed(origin) ? null : 'origin-not-allowed';
  }

  const referer = req.headers.get('referer');
  if (referer) {
    let refererOrigin: string;
    try {
      refererOrigin = new URL(referer).origin;
    } catch {
      return 'invalid-referer';
    }
    return opts.isOriginAllowed(refererOrigin) ? null : 'referer-not-allowed';
  }

  return null;
};
