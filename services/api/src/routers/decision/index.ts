import { mergeRouters } from '../../trpcFactory';
import { instancesRouter } from './instances';
import { processesRouter } from './processes';
import { proposalsRouter } from './proposals';
import { transitionsRouter } from './transitions';
import { uploadProposalAttachment } from './uploadProposalAttachment';

export const decisionRouter = mergeRouters(processesRouter, instancesRouter, proposalsRouter, transitionsRouter, uploadProposalAttachment);
