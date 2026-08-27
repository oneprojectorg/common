// addReaction / removeLike stay module-private: the product writes exactly
// one reaction type now, so `toggleLike` is the only supported way in.
export { getLikeSummary } from './utils';
export type { LikeSummary, LikeUser, ReactionRow } from './utils';
export { toggleLike } from './toggleLike';
export type { ToggleLikeOptions, ToggleLikeResult } from './toggleLike';
