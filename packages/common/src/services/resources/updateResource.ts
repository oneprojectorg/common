import { db } from '@op/db/client';
import { EntityType, resources, type Resource } from '@op/db/schema';
import { permission } from 'access-zones';
import { eq } from 'drizzle-orm';

import { NotFoundError, ValidationError } from '../../utils/error';
import { getResourceById } from './getResourceById';
import { assertResourceAccess } from './resourceAuth';
import { resourceType } from './resourceDTO';
import { type ResourceDTO } from './types';

export type UpdateResourceInput = {
  authUserId: string;
  id: string;
  data: {
    title?: string;
    description?: string | null;
    linkUrl?: string;
  };
};

export const updateResource = async (
  input: UpdateResourceInput,
): Promise<ResourceDTO> => {
  const [existing] = await Promise.all([
    db.query.resources.findFirst({ where: { id: input.id } }),
    assertResourceAccess({
      user: { id: input.authUserId },
      resourceId: input.id,
      policies: {
        [EntityType.DECISION]: { decisions: permission.ADMIN },
      },
    }),
  ]);
  if (!existing) {
    throw new NotFoundError('Resource', input.id);
  }

  const updates: Partial<Resource> = {};
  if (input.data.title !== undefined) {
    updates.title = input.data.title;
  }
  if (input.data.description !== undefined) {
    updates.description = input.data.description;
  }

  if (input.data.linkUrl !== undefined) {
    if (resourceType(existing) !== 'link') {
      throw new ValidationError(
        'linkUrl can only be updated on link resources',
      );
    }
    updates.linkUrl = input.data.linkUrl;
  }

  const [row] = await db
    .update(resources)
    .set(updates)
    .where(eq(resources.id, input.id))
    .returning();

  if (!row) {
    throw new NotFoundError('Resource', input.id);
  }
  return getResourceById({ id: row.id });
};
