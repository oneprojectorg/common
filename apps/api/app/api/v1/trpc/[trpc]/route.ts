import { appRouter, createContext, handleTRPCRequest } from '@op/api';
import { API_TRPC_PTH } from '@op/core';
import type { NextRequest } from 'next/server';

export const maxDuration = 120;

const EXPOSED_HEADERS = 'x-mutation-channels, x-subscription-channels';

const allowedOrigins = [
  'https://api-dev.oneproject.tech',
  'https://api.oneproject.tech',
  'https://app-dev.oneproject.tech',
  'https://app.oneproject.tech',
  'https://common.oneproject.org',
  'https://api-common.oneproject.org',
  // Local development
  'http://localhost:3100',
  'http://localhost:3300',
];

const handler = async (req: NextRequest) => {
  // Use handleTRPCRequest which supports channel accumulation for batched requests.
  // This ensures that when multiple procedures are batched together, their channels
  // are combined into a single set of response headers.
  const response = await handleTRPCRequest({
    endpoint: `/${API_TRPC_PTH}`,
    req,
    router: appRouter,
    createContext,
    onError({ error, path }) {
      console.error(`tRPC Error on ${path}:`, error);
    },
  });

  const origin = req.headers.get('origin');
  if (origin && allowedOrigins.includes(origin)) {
    response.headers.set('Access-Control-Allow-Origin', origin);
  }
  response.headers.set(
    'Access-Control-Allow-Methods',
    'GET, POST, PUT, DELETE, PATCH, HEAD, OPTIONS',
  );
  response.headers.set(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, trpc-batch-mode',
  );
  response.headers.set('Access-Control-Allow-Credentials', 'true');
  response.headers.set('Access-Control-Expose-Headers', EXPOSED_HEADERS);

  return response;
};

const optionsHandler = async (req: NextRequest) => {
  const origin = req.headers.get('origin');
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods':
      'GET, POST, PUT, DELETE, PATCH, HEAD, OPTIONS',
    'Access-Control-Allow-Headers':
      'Content-Type, Authorization, trpc-batch-mode',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Expose-Headers': EXPOSED_HEADERS,
  };

  if (origin && allowedOrigins.includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
  }

  return new Response(null, {
    status: 200,
    headers,
  });
};

export { handler as GET, handler as POST, optionsHandler as OPTIONS };
