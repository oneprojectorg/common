import { mergeRouters } from '../../trpcFactory';
import { deleteProposalAttachment } from './deleteProposalAttachment';
import { instancesRouter } from './instances';
import { listBoundaryShapesRouter } from './listBoundaryShapes';
import { processesRouter } from './processes';
import { proposalsRouter } from './proposals';
import { resolveBoundaryRouter } from './resolveBoundary';
import { resultsRouter } from './results';
import { reviewsRouter } from './reviews';
import { signProposalAttachmentUploadUrl } from './signProposalAttachmentUploadUrl';
import { surveyRouter } from './survey';
import { uploadProposalAttachment } from './uploadProposalAttachment';
import { votingRouter } from './voting';

export const decisionRouter = mergeRouters(
  processesRouter,
  instancesRouter,
  proposalsRouter,
  reviewsRouter,
  resultsRouter,
  signProposalAttachmentUploadUrl,
  uploadProposalAttachment,
  deleteProposalAttachment,
  votingRouter,
  surveyRouter,
  resolveBoundaryRouter,
  listBoundaryShapesRouter,
);

export type { SurveyInternalData } from './survey';
