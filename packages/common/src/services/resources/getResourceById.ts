import { type DbClient, db as defaultDb } from '@op/db/client';

import { NotFoundError } from '../../utils/error';
import { getResource } from './resourceDTO';
import { type ResourceDTO } from './types';

export const getResourceById = async ({
  db = defaultDb,
  id,
}: {
  db?: DbClient;
  id: string;
}): Promise<ResourceDTO> => {
  const row = await db.query.resources.findFirst({
    where: { id },
    with: { attachment: { with: { storageObject: true } } },
  });
  if (!row) {
    throw new NotFoundError('Resource', id);
  }
  return getResource(row);
};
