import { mergeRouters } from '../../trpcFactory';
import { createCustomFormRouter } from './create';
import { deleteCustomFormRouter } from './delete';
import { getForProfile } from './getForProfile';
import { listCustomFormsRouter } from './list';
import { submitCustomForm } from './submit';
import { updateCustomFormRouter } from './update';

export const customFormsRouter = mergeRouters(
  createCustomFormRouter,
  deleteCustomFormRouter,
  getForProfile,
  listCustomFormsRouter,
  submitCustomForm,
  updateCustomFormRouter,
);
