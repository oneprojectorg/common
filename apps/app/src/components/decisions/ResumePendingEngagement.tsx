'use client';

import { useRelationshipMutations } from '@/hooks/useRelationshipMutations';
import { useUser } from '@/utils/UserProvider';
import { isJoinEligible } from '@/utils/isJoinEligible';
import { userCanInteract } from '@/utils/userCanInteract';
import { toast } from '@op/sense/Toast';
import { useQueryState } from 'nuqs';
import { useEffect, useRef, useState } from 'react';

import { useTranslations } from '@/lib/i18n';

import {
  PENDING_ENGAGEMENT_PARAM,
  decideResumeStep,
  parsePendingEngagement,
} from './pendingEngagement';

export const ResumePendingEngagement = ({
  canEngage,
}: {
  canEngage: boolean;
}) => {
  const t = useTranslations('decisions');
  const { user } = useUser();
  const [raw, setRaw] = useQueryState(PENDING_ENGAGEMENT_PARAM);
  const pending = parsePendingEngagement(raw);
  const settledRef = useRef(false);
  const [announcement, setAnnouncement] = useState('');

  const { isLiked, isFollowed, stateUnknown, handleLike, handleFollow } =
    useRelationshipMutations({
      targetProfileId: pending?.profileId,
      enabled: Boolean(pending) && userCanInteract(user) && canEngage,
    });

  useEffect(() => {
    if (settledRef.current) {
      return;
    }
    const step = decideResumeStep({
      raw,
      pending,
      isJoinEligible: isJoinEligible(user),
      canInteract: userCanInteract(user),
      canEngage,
      stateUnknown,
      isLiked,
      isFollowed,
    });
    if (step.type === 'idle' || step.type === 'wait') {
      return;
    }
    settledRef.current = true;
    if (step.type === 'fail' && pending) {
      toast.error(
        pending.action === 'like'
          ? t('resumeLikeFailed')
          : t('resumeFollowFailed'),
      );
    }
    if (step.type === 'apply' && pending) {
      if (step.shouldWrite) {
        if (pending.action === 'like') {
          handleLike();
        } else {
          handleFollow();
        }
      }
      const message =
        pending.action === 'like'
          ? t('resumeLikeCounted')
          : t('resumeFollowCounted');
      toast.success(message);
      setAnnouncement(message);
    }
    void setRaw(null);
  });

  return (
    <span role="status" className="sr-only">
      {announcement}
    </span>
  );
};
