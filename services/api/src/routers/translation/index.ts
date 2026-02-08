import { mergeRouters } from '../../trpcFactory';
import { translateProposalRouter } from './translateProposal';

export const translationRouter = mergeRouters(translateProposalRouter);
