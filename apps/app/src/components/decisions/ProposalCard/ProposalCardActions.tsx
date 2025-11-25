'use client';

import { useRelationshipMutations } from '@/hooks/useRelationshipMutations';
import { trpc } from '@op/api/client';
import type { proposalEncoder } from '@op/api/encoders';
import { Button } from '@op/ui/Button';
import { Heart } from 'lucide-react';
import { LuBookmark } from 'react-icons/lu';
import { z } from 'zod';
import { useQuery } from '@tanstack/react-query';

import { useTranslations } from '@/lib/i18n';

type Proposal = z.infer<typeof proposalEncoder>;

export function ProposalCardActions({
  proposal: initialProposal,
}: {
  proposal: Proposal;
}) {
  const t = useTranslations();

  const { data: currentProposal } = useQuery({
    queryKey: [['decision', 'getProposal'], { profileId: initialProposal.profileId }],
    queryFn: () => trpc.decision.getProposal.query({ profileId: initialProposal.profileId }),
    refetchOnMount: false,
    initialData: initialProposal,
  });

  // Use relationship mutations hook for like/follow functionality
  const {
    isLiked: isLikedByUser,
    isFollowed: isFollowedByUser,
    isLoading,
    handleLike: handleLikeClick,
    handleFollow: handleFollowClick,
  } = useRelationshipMutations({
    targetProfileId: currentProposal.profileId,
    invalidateQueries: [
      {
        profileId: currentProposal.profileId,
        processInstanceId: initialProposal.processInstance?.id,
      },
    ],
  });

  return (
    <div className="flex w-full items-center gap-4 sm:w-auto">
      <Button
        onPress={handleLikeClick}
        size="small"
        color={isLikedByUser ? 'verified' : 'secondary'}
        className="w-full text-nowrap"
        isDisabled={isLoading}
      >
        <Heart className="size-4" />
        {isLikedByUser ? t('Liked') : t('Like')}
      </Button>
      <Button
        onPress={handleFollowClick}
        size="small"
        color={isFollowedByUser ? 'verified' : 'secondary'}
        className="w-full text-nowrap"
        isDisabled={isLoading}
      >
        <LuBookmark className="size-4" />
        {isFollowedByUser ? t('Following') : t('Follow')}
      </Button>
    </div>
  );
}
