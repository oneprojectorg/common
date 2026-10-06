import { mergeRouters } from '../../../trpcFactory';
import { createPhaseRouter } from './createPhase';
import { deletePhaseRouter } from './deletePhase';
import { renamePhaseRouter } from './renamePhase';
import { updatePhaseDataRouter } from './updatePhaseData';

export const phasesRouter = mergeRouters(
  createPhaseRouter,
  renamePhaseRouter,
  updatePhaseDataRouter,
  deletePhaseRouter,
);
