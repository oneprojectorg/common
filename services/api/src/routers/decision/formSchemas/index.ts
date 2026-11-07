import { mergeRouters } from '../../../trpcFactory';
import { createFormSchemaRouter } from './createFormSchema';
import { getFormSchemaRouter } from './getFormSchema';
import { listFormSchemasRouter } from './listFormSchemas';

export const formSchemasRouter = mergeRouters(
  createFormSchemaRouter,
  getFormSchemaRouter,
  listFormSchemasRouter,
);
