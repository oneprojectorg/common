/* eslint-disable ts/no-empty-object-type */
import type { db } from '@op/db/client';
import type { tables } from '@op/db/tables';
import type { Logger } from '@op/logging';
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
  /** NOTE: this is used only in tests only, Supabase Auth JWT token */
  jwt?: string;
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

export interface TContextWithLogger {
  logger: Logger;
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
