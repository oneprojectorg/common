/* eslint-disable ts/no-empty-object-type */
import type { db } from '@op/db/client';
import type { tables } from '@op/db/tables';
import type { User } from '@op/supabase/lib';
import type { MiddlewareFunction } from '@trpc/server/unstable-core-do-not-import';
import type { SerializeOptions } from 'cookie';
import type { OpenApiMeta } from 'trpc-to-openapi';

export interface TContext {
  getCookies: () => Record<string, string | undefined>;
  getCookie: (name: string) => string | undefined;
  setCookie: (opts: {
    name: string;
    value: string;
    options?: SerializeOptions;
  }) => void;
  requestId: string;
  time: number;
  ip: string | null;
  reqUrl: string | undefined;
  req: Request;
  isServerSideCall?: boolean;
}

export interface TContextWithUser {
  user: User;
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
  OpenApiMeta,
  unknown,
  TContextAfter,
  unknown
>;

export type MiddlewareBuilderBeforeAfter<
  TContextBefore = {},
  TContextAfter = {},
> = MiddlewareFunction<
  TContext & TContextBefore,
  OpenApiMeta,
  unknown,
  TContextAfter,
  unknown
>;
