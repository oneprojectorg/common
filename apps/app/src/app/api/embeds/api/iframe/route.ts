import type { NextRequest } from 'next/server';

import { proxyIframelyCdn } from '../../proxyIframelyCdn';

// The embed document is arbitrary third-party HTML/JS. Auth cookies are
// Domain=.oneproject.* and CORS allowlists oneproject.* origins, so served
// plainly from our own host (or any subdomain) an embed script could call
// the API with the viewer's credentials. The CSP sandbox (without
// allow-same-origin) gives the document an opaque origin instead: no cookie
// or storage access, and its requests carry `Origin: null`, which fails the
// API's CORS check.
const EMBED_SANDBOX_CSP =
  'sandbox allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-presentation';

export async function GET(request: NextRequest) {
  return proxyIframelyCdn({
    path: '/api/iframe',
    search: request.nextUrl.search,
    responseHeaders: {
      'Content-Security-Policy': EMBED_SANDBOX_CSP,
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
