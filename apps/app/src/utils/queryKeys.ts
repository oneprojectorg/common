// Centralized query key constants to prevent cache misses
export const QUERY_KEYS = {
  COMMENTS: {
    LIMIT: 50,
    OFFSET: 0,
    INCLUDE_CHILDREN: false,
  },
  POSTS: {
    DEFAULT_LIMIT: 20,
  },
} as const;

// Helper function to create consistent comment query parameters
export const createCommentsQueryKey = (
  parentPostId: string,
  profileId?: string,
) => ({
  parentPostId,
  profileId,
  limit: QUERY_KEYS.COMMENTS.LIMIT,
  offset: QUERY_KEYS.COMMENTS.OFFSET,
  includeChildren: QUERY_KEYS.COMMENTS.INCLUDE_CHILDREN,
});

// Helper function to create consistent posts query parameters
export const createPostsQueryKey = (
  slug: string,
  limit = QUERY_KEYS.POSTS.DEFAULT_LIMIT,
) => ({
  slug,
  limit,
});
