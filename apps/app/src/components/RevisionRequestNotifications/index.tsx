'use client';

import { trpc } from '@op/api/client';
import {
  ProposalReviewRequestState,
  type ProposalRevisionRequestItem,
} from '@op/common/client';
import { Button } from '@op/sense/Button';
import {
  NotificationPanel,
  NotificationPanelActions,
  NotificationPanelHeader,
  NotificationPanelItem,
  NotificationPanelList,
} from '@op/sense/NotificationPanel';
import { ProfileItem } from '@op/sense/ProfileItem';
import { Suspense, useState } from 'react';
import { LuPenLine } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { ButtonLink } from '../ButtonLink';
import ErrorBoundary from '../ErrorBoundary';

const RevisionRequestNotificationsSuspense = () => {
  const t = useTranslations();

  const [{ items: revisionRequests }] =
    trpc.decision.listProposalsRevisionRequests.useSuspenseQuery({
      states: [ProposalReviewRequestState.REQUESTED],
    });

  if (revisionRequests.length === 0) {
    return null;
  }

  return (
    <NotificationPanel>
      <NotificationPanelHeader
        title={t('decisions.revisionRequestsHeading')}
        count={revisionRequests.length}
      />
      <NotificationPanelList>
        {revisionRequests.map((item) => (
          <RevisionRequestRow key={item.revisionRequest.id} item={item} />
        ))}
      </NotificationPanelList>
    </NotificationPanel>
  );
};

/**
 * Proposals a reviewer has sent back to the user for changes. The user's
 * active processes themselves are listed by the home page's ActiveProcesses.
 */
export const RevisionRequestNotifications = () => {
  return (
    <ErrorBoundary fallback={null}>
      <Suspense fallback={null}>
        <RevisionRequestNotificationsSuspense />
      </Suspense>
    </ErrorBoundary>
  );
};

const RevisionRequestIcon = () => (
  <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-warning/10 text-warning">
    <LuPenLine className="size-6" />
  </div>
);

// TODO: persist dismiss state and navigate to proposal edit — will be addressed in a coming PR
const RevisionRequestRow = ({
  item,
}: {
  item: ProposalRevisionRequestItem;
}) => {
  const t = useTranslations();
  const [dismissed, setDismissed] = useState(false);
  const [navigating, setNavigating] = useState(false);

  if (dismissed) {
    return null;
  }

  const { proposal } = item;
  const title = proposal.profile.name;
  const editHref = `/decisions/${item.decisionProfileSlug}/proposal/${proposal.profileId}/edit`;

  return (
    <NotificationPanelItem>
      <ProfileItem
        avatar={<RevisionRequestIcon />}
        title={t('decisions.revisionRequestLabel')}
        description={t('decisions.revisionRequestedNotification', {
          proposalName: title,
        })}
      />
      <NotificationPanelActions className="flex-col-reverse">
        <Button
          variant="outline"
          className="w-full sm:w-auto"
          onClick={() => setDismissed(true)}
        >
          {t('decisions.ignoreAction')}
        </Button>
        <ButtonLink
          href={editHref}
          className="w-full sm:w-auto"
          onClick={() => setNavigating(true)}
          loading={navigating}
        >
          {t('decisions.proposals.reviseProposalAction')}
        </ButtonLink>
      </NotificationPanelActions>
    </NotificationPanelItem>
  );
};
