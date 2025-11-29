import type { ChannelName } from '@op/realtime';
import { initTRPC } from '@trpc/server';
import type { FetchCreateContextFnOptions } from '@trpc/server/adapters/fetch';
import { customAlphabet } from 'nanoid';
import superjson from 'superjson';
import type { OpenApiMeta } from 'trpc-to-openapi';

import {
  MUTATION_CHANNELS_HEADER,
  SUBSCRIPTION_CHANNELS_HEADER,
} from './constants';
import {
  getCookie as _getCookie,
  getCookies as _getCookies,
  setCookie as _setCookie,
} from './lib/cookies';
import { errorFormatter } from './lib/error';
import withLogger from './middlewares/withLogger';
import type { TContext } from './types';

export const createContext = async ({
  req,
  resHeaders,
}: FetchCreateContextFnOptions): Promise<TContext> => {
  const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 24);

  // seperate in 4-8-8-4 xxxx-xxxxxxxx-xxxxxxxx-xxxx
  const requestId = [
    nanoid().slice(0, 4),
    nanoid().slice(4, 12),
    nanoid().slice(12, 20),
    nanoid().slice(20, 24),
  ].join('-');

  resHeaders.set('x-request-id', requestId);

  const getCookies: TContext['getCookies'] = () => {
    return _getCookies(req);
  };

  const getCookie: TContext['getCookie'] = (name) => {
    return _getCookie(req, name);
  };

  const setCookie: TContext['setCookie'] = ({ name, value, options }) => {
    return _setCookie({ resHeaders, name, value, options });
  };

  const setMutationChannels: TContext['setMutationChannels'] = (
    channels: ChannelName[],
  ) => {
    if (channels.length > 0) {
      resHeaders.set(MUTATION_CHANNELS_HEADER, channels.join(','));
    }
  };

  const setSubscriptionChannels: TContext['setSubscriptionChannels'] = (
    channels: ChannelName[],
  ) => {
    if (channels.length > 0) {
      resHeaders.set(SUBSCRIPTION_CHANNELS_HEADER, channels.join(','));
    }
  };

  return {
    getCookies,
    getCookie,
    setCookie,
    setMutationChannels,
    setSubscriptionChannels,
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
export const loggedProcedure = t.procedure.use(withLogger);
