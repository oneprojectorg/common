/**
 * Drizzle definition for the users_used_storage view
 * This view is used to track the total size of all objects in the assets bucket for each user
 */

import { eq, sql } from 'drizzle-orm';
import { pgView } from 'drizzle-orm/pg-core';

import { objectsInStorage } from './storage.sql';

export const usersUsedStorage = pgView('users_used_storage')
  .with({
    // TODO: when true causes infinite recursion because of the security policies
    securityInvoker: false,
  })
  .as((qb) => {
    return qb
      .select({
        userId: sql`(storage.foldername(${objectsInStorage.name}))[1]`.as('user_id'),
        totalSize: sql`COALESCE(SUM((${objectsInStorage.metadata}->>'size')::bigint), 0)`.as('total_size'),
      })
      .from(objectsInStorage)
      .where(eq(objectsInStorage.bucketId, 'assets'))
      .groupBy(sql`(storage.foldername(${objectsInStorage.name}))[1]`);
  });
