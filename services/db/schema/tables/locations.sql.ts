import {
  index,
  jsonb,
  numeric,
  pgTable,
  text,
  varchar,
} from 'drizzle-orm/pg-core';

import { autoId, serviceRolePolicies, timestamps } from '../../helpers';

export const locations = pgTable(
  'locations',
  {
    id: autoId().primaryKey(),
    name: varchar({ length: 256 }),
    placeId: varchar({ length: 512 }),
    address: text(),
    plusCode: varchar({ length: 128 }),
    lat: numeric({ precision: 10, scale: 8 }),
    lng: numeric({ precision: 11, scale: 8 }),
    countryCode: varchar({ length: 2 }),
    countryName: varchar({ length: 256 }),
    metadata: jsonb(),
    ...timestamps,
  },
  (table) => [
    ...serviceRolePolicies,
    index().on(table.id).concurrently(),
    index().on(table.placeId).concurrently(),
  ],
);
