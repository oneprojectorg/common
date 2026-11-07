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
  clearPendingEngagementProof,
  decideResumeStep,
  parsePendingEngagement,
  readPendingEngagementProof,
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

  const {
    isLiked,
    isFollowed,
    stateUnknown,
    lookupFailed,
    handleLike,
    handleFollow,
  } = useRelationshipMutations({
    targetProfileId: pending?.profileId,
    enabled: Boolean(pending) && userCanInteract(user) && canEngage,
    errorToasts: false,
  });

  useEffect(() => {
    if (settledRef.current) {
      return;
    }
    const step = decideResumeStep({
      raw,
      pending,
      hasProof: raw !== null && readPendingEngagementProof() === raw,
      isJoinEligible: isJoinEligible(user),
      canInteract: userCanInteract(user),
      canEngage,
      stateUnknown,
      lookupFailed,
      isLiked,
      isFollowed,
    });
    if (step.type === 'idle' || step.type === 'wait') {
      return;
    }
    settledRef.current = true;
    const settle = () => {
      clearPendingEngagementProof();
      void setRaw(null);
    };
    if (step.type === 'clear' || !pending) {
      settle();
      return;
    }
    const failureMessage =
      pending.action === 'like'
        ? t('resumeLikeFailed')
        : t('resumeFollowFailed');
    if (step.type === 'fail') {
      toast.error(failureMessage);
      settle();
      return;
    }
    const announce = () => {
      const message =
        pending.action === 'like'
          ? t('resumeLikeCounted')
          : t('resumeFollowCounted');
      toast.success(message);
      setAnnouncement(message);
    };
    if (!step.shouldWrite) {
      announce();
      settle();
      return;
    }
    const write = pending.action === 'like' ? handleLike : handleFollow;
    void write()
      .then(
        (succeeded) => {
          if (succeeded) {
            announce();
          } else {
            toast.error(failureMessage);
          }
        },
        // The drain can reject (a reconcile that throws escapes its try). The
        // param and the proof must still clear, or the replay re-arms on the
        // next mount.
        () => toast.error(failureMessage),
      )
      .finally(settle);
  });

  return (
    <span role="status" className="sr-only">
      {announcement}
    </span>
  );
};
