import { mergeRouters, router } from '../../../trpcFactory';
import { collectionsCreate } from './create';
import { collectionsDelete } from './delete';
import { collectionsList } from './list';
import { collectionsReorder } from './reorder';
import { collectionsUpdate } from './update';

export const collectionsRouter = router({
  collections: mergeRouters(
    collectionsList,
    collectionsCreate,
    collectionsUpdate,
    collectionsReorder,
    collectionsDelete,
  ),
});
