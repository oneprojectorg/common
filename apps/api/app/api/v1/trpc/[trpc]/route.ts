import {
  MUTATION_CHANNELS_HEADER,
  QUERY_CHANNELS_HEADER,
  appRouter,
  createContext,
} from '@op/api';
import { API_TRPC_PTH } from '@op/core';
import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import type { NextRequest } from 'next/server';

export const maxDuration = 120;

const EXPOSED_HEADERS = 'x-mutation-channels, x-query-channels';

const allowedOrigins = [
  'https://api-dev.oneproject.tech',
  'https://api.oneproject.tech',
  'https://app-dev.oneproject.tech',
  'https://app.oneproject.tech',
  'https://common.oneproject.org',
  'https://api-common.oneproject.org',
];

const handler = async (req: NextRequest) => {
  const response = await fetchRequestHandler({
    endpoint: `/${API_TRPC_PTH}`,
    req,
    router: appRouter,
    createContext,
    onError({ error, path }) {
      console.error(`tRPC Error on ${path}:`, error);
    },
    responseMeta({ ctx }) {
      if (!ctx) {
        return {};
      }

      const headers: Record<string, string> = {};
      const mutationChannels = ctx.getMutationChannels();
      const queryChannels = ctx.getQueryChannels();

      if (queryChannels.length > 0) {
        headers[QUERY_CHANNELS_HEADER] = queryChannels.join(',');
      }
      if (mutationChannels.length > 0) {
        headers[MUTATION_CHANNELS_HEADER] = mutationChannels.join(',');
      }

      if (Object.keys(headers).length > 0) {
        return {
          headers: new Headers(Object.entries(headers)),
        };
      }

      return {};
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
