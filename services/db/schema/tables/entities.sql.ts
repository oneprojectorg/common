import { pgEnum } from 'drizzle-orm/pg-core';

import { enumToPgEnum } from '../../helpers';

export enum EntityType {
  ORG = 'org',
  USER = 'user',
  INDIVIDUAL = 'individual',
}

export const entityTypeEnum = pgEnum('entity_type', enumToPgEnum(EntityType));
