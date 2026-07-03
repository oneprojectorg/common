import { mergeRouters } from '../../trpcFactory';
import { getForProfile } from './getForProfile';
import { submitCustomForm } from './submit';

export const customFormsRouter = mergeRouters(getForProfile, submitCustomForm);
