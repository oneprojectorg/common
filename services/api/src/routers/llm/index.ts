import { mergeRouters } from '../../trpcFactory';
import chat from './chat';

const llmRouter = mergeRouters(chat);

export default llmRouter;
