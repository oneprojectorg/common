import type { ChannelName } from '@op/common/realtime';
import type { db } from '@op/db/client';
import type { tables } from '@op/db/tables';
import type { User } from '@op/supabase/lib';
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

/** Context after successful user authentication. `user` is our internal
 * {@link User} shape — only the fields the verified JWT carries; callers that
 * need authoritative server-side fields (`confirmed_at`, `last_sign_in_at`,
 * ...) reach for the SDK's `UserResponse` directly. */
export interface TContextWithUser {
  user: User;
}

/** Context after optional user resolution: `user` is the {@link User} shape,
 * or `undefined` when the caller has no valid session. */
export interface TContextWithMaybeUser {
  user?: User;
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
