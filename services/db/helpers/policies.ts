import { pgPolicy } from 'drizzle-orm/pg-core';
import { serviceRole } from 'drizzle-orm/supabase';

export const serviceRolePolicies = [
  pgPolicy(`service-role`, {
    as: 'permissive',
    for: 'all',
    to: serviceRole,
  }),
];
