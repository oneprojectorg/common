import { mergeRouters } from '../../../trpcFactory';
import { createPhaseRouter } from './createPhase';
import { deletePhaseRouter } from './deletePhase';
import { renamePhaseRouter } from './renamePhase';

export const phasesRouter = mergeRouters(
  createPhaseRouter,
  renamePhaseRouter,
  deletePhaseRouter,
);
