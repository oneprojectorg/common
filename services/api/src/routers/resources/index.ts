import { mergeRouters } from '../../trpcFactory';
import { attachToCollection } from './attachToCollection';
import { collectionsRouter } from './collections';
import { createDocument } from './createDocument';
import { createLink } from './createLink';
import { deleteResourceRouter } from './delete';
import { detachFromCollection } from './detachFromCollection';
import { list } from './list';
import { listAcrossCollections } from './listAcrossCollections';
import { listByCollection } from './listByCollection';
import { reorder } from './reorder';
import { update } from './update';
import { uploadFile } from './uploadFile';

export const resourcesRouter = mergeRouters(
  collectionsRouter,
  list,
  listAcrossCollections,
  listByCollection,
  createLink,
  createDocument,
  uploadFile,
  update,
  reorder,
  attachToCollection,
  detachFromCollection,
  deleteResourceRouter,
);
