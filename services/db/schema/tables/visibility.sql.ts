import { pgEnum } from 'drizzle-orm/pg-core';

import { enumToPgEnum } from '../../helpers';

export enum Visibility {
  VISIBLE = 'visible',
  HIDDEN = 'hidden',
}

export const visibilityEnum = pgEnum('visibility', enumToPgEnum(Visibility));
