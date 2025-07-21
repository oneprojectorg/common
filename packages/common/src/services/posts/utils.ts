export const getReactionCounts = ({
  reactions,
  profileId,
}: {
  reactions: any[];
  profileId: string;
}) => {
  const reactionCounts: Record<string, number> = {};
  const userReactions: string[] = [];
  // Count reactions by type
  if (reactions) {
    reactions.forEach(
      (reaction: { reactionType: string; profileId: string }) => {
        reactionCounts[reaction.reactionType] =
          (reactionCounts[reaction.reactionType] || 0) + 1;

        // Track user's reactions
        if (reaction.profileId === profileId) {
          userReactions.push(reaction.reactionType);
        }
      },
    );
  }

  return { reactionCounts, userReactions };
};
