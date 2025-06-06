'use server';

import { OPURLConfig } from '@op/core';
import {
  createTRPCProxyClient,
  unstable_httpBatchStreamLink,
} from '@trpc/client';
import { headers } from 'next/headers';
import superjson from 'superjson';

import { type AppRouter } from './routers';

const envURL = OPURLConfig('API');

export const createTRPCNextClient = async () => {
  return createTRPCProxyClient<AppRouter>({
    links: [
      unstable_httpBatchStreamLink({
        url: envURL.TRPC_URL,
        transformer: superjson,
        headers: Object.fromEntries(await headers()),
      }),
    ],
  });
};
