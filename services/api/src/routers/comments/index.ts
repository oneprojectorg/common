import { mergeRouters } from '../../trpcFactory';
import { createComment } from './createComment';
import { deleteComment } from './deleteComment';
import { getComments } from './getComments';
import { updateComment } from './updateComment';

export const commentsRouter = mergeRouters(
  createComment,
  updateComment,
  deleteComment,
  getComments,
);
