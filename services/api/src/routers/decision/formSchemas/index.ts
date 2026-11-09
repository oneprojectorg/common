import { mergeRouters } from '../../../trpcFactory';
import { getFormSchemaRouter } from './getFormSchema';
import { listFormSchemasRouter } from './listFormSchemas';

export const formSchemasRouter = mergeRouters(
  getFormSchemaRouter,
  listFormSchemasRouter,
);
