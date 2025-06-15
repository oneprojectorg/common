import { index, jsonb, pgTable, text, varchar } from 'drizzle-orm/pg-core';
import { geometry } from 'drizzle-orm/pg-core';

import { autoId, serviceRolePolicies, timestamps } from '../../helpers';

export const locations = pgTable(
  'locations',
  {
    id: autoId().primaryKey(),
    name: varchar({ length: 256 }),
    placeId: varchar({ length: 512 }).unique().notNull(),
    address: text(),
    plusCode: varchar({ length: 128 }),
    location: geometry({ type: 'point', mode: 'xy', srid: 4326 }),
    countryCode: varchar({ length: 2 }),
    countryName: varchar({ length: 256 }),
    metadata: jsonb(),
    ...timestamps,
  },
  (table) => [
    ...serviceRolePolicies,
    index().on(table.id).concurrently(),
    index().on(table.placeId).concurrently(),
    index('spatial_index').using('gist', table.location),
  ],
);
