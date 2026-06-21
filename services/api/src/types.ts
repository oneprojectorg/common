import type { ChannelName } from '@op/common/realtime';
import type { db } from '@op/db/client';
import type { tables } from '@op/db/tables';
import type { ClaimsUser, User } from '@op/supabase/lib';
import type { MiddlewareFunction } from '@trpc/server/unstable-core-do-not-import';
import type { SerializeOptions } from 'cookie';

export interface TContext {
  getCookies: () => Record<string, string | undefined>;
  getCookie: (name: string) => string | undefined;
  setCookie: (opts: {
    name: string;
    value: string;
    options?: SerializeOptions;
  }) => void;
  /** Registers channels that a mutation invalidates and publishes invalidation events. */
  registerMutationChannels: (channels: ChannelName[]) => void;
  /** Registers channels that a query subscribes to for invalidation. */
  registerQueryChannels: (channels: ChannelName[]) => void;
  requestId: string;
  time: number;
  ip: string | null;
  reqUrl: string | undefined;
  req: Request;
  isServerSideCall?: boolean;
}

/** Context produced by the authoritative auth path (confirmed / network /
 * platform-admin middlewares). `user` is the full Supabase `User`, including
 * server-side timestamps like `last_sign_in_at` and `confirmed_at`. */
export interface TContextWithUser {
  user: User;
}

/** Context produced by the local-verify auth path (`withResolvedUser` →
 * `withAuthenticatedUser`). `user` is a {@link ClaimsUser}: only the fields
 * carried in the JWT, with server-side timestamps deliberately absent. */
export interface TContextWithClaimsUser {
  user: ClaimsUser;
}

/** Context after optional user resolution on the local-verify path: `user` is
 * a {@link ClaimsUser}, or `undefined` when the caller has no valid session. */
export interface TContextWithMaybeUser {
  user?: ClaimsUser;
}

export interface TContextWithAnalytics {
  analyticsDistinctId?: string;
}

export interface TContextWithDB {
  database: {
    /** Drizzle database client */
    db: typeof db;
    /** Drizzle table schemas */
    tables: typeof tables;
  };
}

/** Logger interface for tRPC context */
interface ContextLogger {
  debug: (message: string, data?: Record<string, unknown>) => void;
  info: (message: string, data?: Record<string, unknown>) => void;
  warn: (message: string, data?: Record<string, unknown>) => void;
  error: (message: string, data?: Record<string, unknown>) => void;
}

export interface TContextWithLogger {
  logger: ContextLogger;
}

export type MiddlewareBuilderBase<TContextAfter = {}> = MiddlewareFunction<
  TContext,
  object,
  unknown,
  TContextAfter,
  unknown
>;

export type MiddlewareBuilderBeforeAfter<
  TContextBefore = {},
  TContextAfter = {},
> = MiddlewareFunction<
  TContext & TContextBefore,
  object,
  unknown,
  TContextAfter,
  unknown
>;
