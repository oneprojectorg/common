import type { ChannelName } from '@op/common/realtime';
import { realtime } from '@op/realtime/server';
import { initTRPC } from '@trpc/server';
import type { FetchCreateContextFnOptions } from '@trpc/server/adapters/fetch';
import { waitUntil } from '@vercel/functions';
import { customAlphabet } from 'nanoid';
import superjson from 'superjson';
import type { OpenApiMeta } from 'trpc-to-openapi';

import {
  getCookie as _getCookie,
  getCookies as _getCookies,
  setCookie as _setCookie,
} from './lib/cookies';
import { errorFormatter } from './lib/error';
import withChannelMeta from './middlewares/withChannelMeta';
import withLogger from './middlewares/withLogger';
import type { TContext } from './types';

export const createContext = async ({
  req,
  resHeaders,
}: FetchCreateContextFnOptions): Promise<TContext> => {
  const mutationChannels = new Set<ChannelName>();
  const queryChannels = new Set<ChannelName>();
  const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 24);

  // seperate in 4-8-8-4 xxxx-xxxxxxxx-xxxxxxxx-xxxx
  const requestId = [
    nanoid().slice(0, 4),
    nanoid().slice(4, 12),
    nanoid().slice(12, 20),
    nanoid().slice(20, 24),
  ].join('-');

  resHeaders.set('x-request-id', requestId);

  return {
    getCookies: () => _getCookies(req),
    getCookie: (name) => _getCookie(req, name),
    setCookie: ({ name, value, options }) =>
      _setCookie({ resHeaders, name, value, options }),
    registerMutationChannels: (channels) => {
      for (const channel of channels) {
        mutationChannels.add(channel);
        // Publish mutation event to channel
        waitUntil(
          realtime.publish(channel, {
            mutationId: requestId,
          }),
        );
      }
    },
    registerQueryChannels: (channels) => {
      for (const channel of channels) {
        queryChannels.add(channel);
      }
    },
    getMutationChannels: () => Array.from(mutationChannels),
    getQueryChannels: () => Array.from(queryChannels),
    requestId,
    time: Date.now(),
    ip: req.headers.get('X-Forwarded-For') || null,
    reqUrl: req.url,
    req,
  };
};

const t = initTRPC
  .meta<OpenApiMeta>()
  .context<TContext>()
  .create({
    errorFormatter,
    transformer: superjson,
    experimental: {
      iterablesAndDeferreds: true,
    },
  });

export const { router } = t;
export const { middleware } = t;
export const { mergeRouters } = t;
export const createCallerFactory = t.createCallerFactory;
export const loggedProcedure = t.procedure.use(withChannelMeta).use(withLogger);
