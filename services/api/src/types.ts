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
}

export interface TContextWithUser {
  user: User;
}

export interface TContextWithDB {
  database: {
    /** Drizzle database client */
    db: typeof db;
    /** Drizzle table schemas */
    tables: typeof tables;
  };
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
