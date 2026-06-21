import { appRouter, createContext } from '@op/api';
import {
  API_TRPC_PTH,
  CSRF_HEADER,
  OPURLConfig,
  csrfRejection,
  originUrlMatcher,
} from '@op/core';
import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import type { NextRequest } from 'next/server';

export const maxDuration = 120;

const EXPOSED_HEADERS = 'x-request-id';
const ALLOWED_HEADERS = `Content-Type, Authorization, trpc-batch-mode, ${CSRF_HEADER}`;

const { IS_DEVELOPMENT } = OPURLConfig('API');

const isAllowedOrigin = (origin: string | null): boolean => {
  if (!origin) {
    return false;
  }

  return originUrlMatcher.test(origin);
};

// Permissive predicate in dev so callers from localhost:3100 work; the
// custom-header requirement still applies, which is the load-bearing
// part of the CSRF defense.
const isCsrfOriginAllowed = (origin: string): boolean =>
  IS_DEVELOPMENT || originUrlMatcher.test(origin);

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
