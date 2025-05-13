import { appRouter, createContext } from '@op/api';
import { API_TRPC_PTH } from '@op/core';
import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import type { NextRequest } from 'next/server';

export const maxDuration = 120;

const handler = async (req: NextRequest) => {
  return fetchRequestHandler({
    endpoint: `/${API_TRPC_PTH}`,
    req,
    router: appRouter,
    createContext,
  });
};

export { handler as GET, handler as POST };
