import { mergeRouters } from '../../trpcFactory';
import { linkPreview } from './linkPreview';

export const contentRouter = mergeRouters(linkPreview);
