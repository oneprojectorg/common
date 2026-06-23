import { appRouter, createContext } from '@op/api';
import {
  API_TRPC_PTH,
  CSRF_HEADER,
  csrfRejection,
  originUrlMatcher,
} from '@op/core';
import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import type { NextRequest } from 'next/server';

export const maxDuration = 120;

const EXPOSED_HEADERS = 'x-request-id';
const ALLOWED_HEADERS = `Content-Type, Authorization, trpc-batch-mode, ${CSRF_HEADER}`;

// Apex domains we trust for the CSRF gate. Subdomains of these (e.g.
// `app.oneproject.org`, `api-dev.oneproject.tech`) are accepted too.
const TRUSTED_DOMAINS = ['oneproject.org', 'oneproject.tech'];
// Vercel preview suffix matches the legitimate team naming (`*-oneproject`
// is the team slug); a stranger team can't squat this suffix.
const TRUSTED_VERCEL_SUFFIX = '-oneproject.vercel.app';

const isAllowedOrigin = (origin: string | null): boolean => {
  if (!origin) {
    return false;
  }

  return originUrlMatcher.test(origin);
};

// Host-matched CSRF allowlist. Parses Origin as a URL so we compare on the
// hostname (e.g. `notoneproject.org` doesn't match `oneproject.org`), and
// allows localhost so dev callers work without an env-driven bypass.
const isCsrfOriginAllowed = (origin: string): boolean => {
  let hostname: string;
  try {
    hostname = new URL(origin).hostname;
  } catch {
    return false;
  }

  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return true;
  }

  for (const domain of TRUSTED_DOMAINS) {
    if (hostname === domain || hostname.endsWith(`.${domain}`)) {
      return true;
    }
  }

  return hostname.endsWith(TRUSTED_VERCEL_SUFFIX);
};

const handler = async (req: NextRequest) => {
  const reason = csrfRejection(req, { isOriginAllowed: isCsrfOriginAllowed });
  if (reason) {
    return new Response(`Forbidden: ${reason}`, { status: 403 });
  }

  const response = await fetchRequestHandler({
    endpoint: `/${API_TRPC_PTH}`,
    req,
    router: appRouter,
    createContext,
    onError({ error, path }) {
      console.error(`tRPC Error on ${path}:`, error);
    },
  });

  const origin = req.headers.get('origin');
  if (origin && isAllowedOrigin(origin)) {
    response.headers.set('Access-Control-Allow-Origin', origin);
  }
  response.headers.set(
    'Access-Control-Allow-Methods',
    'GET, POST, PUT, DELETE, PATCH, HEAD, OPTIONS',
  );
  response.headers.set('Access-Control-Allow-Headers', ALLOWED_HEADERS);
  response.headers.set('Access-Control-Allow-Credentials', 'true');
  response.headers.set('Access-Control-Expose-Headers', EXPOSED_HEADERS);

  return response;
};

const optionsHandler = async (req: NextRequest) => {
  const origin = req.headers.get('origin');
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods':
      'GET, POST, PUT, DELETE, PATCH, HEAD, OPTIONS',
    'Access-Control-Allow-Headers': ALLOWED_HEADERS,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Expose-Headers': EXPOSED_HEADERS,
  };

  if (origin && isAllowedOrigin(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
  }

  return new Response(null, {
    status: 200,
    headers,
  });
};

export { handler as GET, handler as POST, optionsHandler as OPTIONS };
