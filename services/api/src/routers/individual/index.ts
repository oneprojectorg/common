import { mergeRouters } from '../../trpcFactory';
import { getIndividualRouter } from './getIndividual';

const individualRouter = mergeRouters(getIndividualRouter);

export default individualRouter;
