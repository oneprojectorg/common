import { mergeRouters } from '../../trpcFactory';
import { collectionsRouter } from './collections';
import { createDocument } from './createDocument';
import { createLink } from './createLink';
import { deleteResourceRouter } from './delete';
import { list } from './list';
import { listByCollection } from './listByCollection';
import { moveToCollection } from './moveToCollection';
import { reorder } from './reorder';
import { update } from './update';
import { uploadFile } from './uploadFile';

export const resourcesRouter = mergeRouters(
  collectionsRouter,
  list,
  listByCollection,
  createLink,
  createDocument,
  uploadFile,
  update,
  reorder,
  moveToCollection,
  deleteResourceRouter,
);
