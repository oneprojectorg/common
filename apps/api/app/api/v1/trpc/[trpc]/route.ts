import { appRouter, createContext } from '@op/api';
import { API_TRPC_PTH } from '@op/core';
import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import type { NextRequest } from 'next/server';

export const maxDuration = 120;

const allowedOrigins = [
  'https://app-dev.oneproject.tech',
  'https://app.oneproject.tech',
  'https://common.oneproject.org',
];

const handler = async (req: NextRequest) => {
  const response = await fetchRequestHandler({
    endpoint: `/${API_TRPC_PTH}`,
    req,
    router: appRouter,
    createContext,
  });

  const corsResponse = new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: new Headers(response.headers),
  });

  const origin = req.headers.get('origin');
  if (origin && allowedOrigins.includes(origin)) {
    corsResponse.headers.set('Access-Control-Allow-Origin', origin);
  }
  corsResponse.headers.set(
    'Access-Control-Allow-Methods',
    'GET, POST, PUT, DELETE, PATCH, HEAD, OPTIONS',
  );
  corsResponse.headers.set(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, trpc-batch-mode',
  );
  corsResponse.headers.set('Access-Control-Allow-Credentials', 'true');

  return corsResponse;
};

const optionsHandler = async (req: NextRequest) => {
  const origin = req.headers.get('origin');
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, HEAD, OPTIONS',
    'Access-Control-Allow-Headers':
      'Content-Type, Authorization, trpc-batch-mode',
    'Access-Control-Allow-Credentials': 'true',
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
