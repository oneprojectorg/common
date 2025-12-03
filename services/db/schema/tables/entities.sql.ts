import { pgEnum } from 'drizzle-orm/pg-core';

import { enumToPgEnum } from '../../helpers';

export enum EntityType {
  ORG = 'org',
  /** @deprecated use 'individual' instead */
  USER = 'user',
  INDIVIDUAL = 'individual',
  PROPOSAL = 'proposal',
  DECISION = 'decision',
}

export const entityTypeEnum = pgEnum('entity_type', enumToPgEnum(EntityType));
