import { mergeRouters } from '../../../trpcFactory';
import { submitReviewRouter } from './submitReview';

export const reviewsRouter = mergeRouters(submitReviewRouter);
