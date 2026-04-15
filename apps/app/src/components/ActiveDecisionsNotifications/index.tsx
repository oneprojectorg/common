'use client';

import { trpc } from '@op/api/client';
import { ProcessStatus } from '@op/api/encoders';
import type { ProposalRevisionRequestItem } from '@op/common/client';
import { getTextPreview } from '@op/core';
import { Button, ButtonLink } from '@op/ui/Button';
import {
  NotificationPanel,
  NotificationPanelActions,
  NotificationPanelHeader,
  NotificationPanelItem,
  NotificationPanelList,
} from '@op/ui/NotificationPanel';
import { ProfileItem } from '@op/ui/ProfileItem';
import { Suspense, useState } from 'react';
import { LuPenLine } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { DecisionAvatar } from '../DecisionAvatar';
import ErrorBoundary from '../ErrorBoundary';

const ActiveDecisionsNotificationsSuspense = () => {
  const t = useTranslations();
  const [navigatingId, setNavigatingId] = useState<string | null>(null);

  const [[{ items: decisions }, { revisionRequests }]] =
    trpc.useSuspenseQueries((t) => [
      t.decision.listDecisionProfiles({
        status: [ProcessStatus.PUBLISHED],
        limit: 10,
      }),
      t.decision.listProposalsRevisionRequests({}),
    ]);

  const count = decisions.length + revisionRequests.length;

  if (count === 0) {
    return null;
  }

  return (
    <NotificationPanel>
      <NotificationPanelHeader title={t('Active Decisions')} count={count} />
      <NotificationPanelList>
        {revisionRequests.map((item) => (
          <RevisionRequestRow key={item.revisionRequest.id} item={item} />
        ))}
        {decisions.map((decision) => {
          const instance = decision.processInstance;
          const description = instance?.description;
          const isNavigating = navigatingId === decision.id;

          return (
            <NotificationPanelItem key={decision.id}>
              <ProfileItem
                avatar={<DecisionAvatar profile={decision} />}
                title={decision.name}
                description={
                  description
                    ? getTextPreview({ content: description })
                    : undefined
                }
              />
              <NotificationPanelActions>
                <ButtonLink
                  size="small"
                  className="w-full sm:w-auto"
                  href={`/decisions/${decision.slug}`}
                  onPress={() => setNavigatingId(decision.id)}
                  isLoading={isNavigating}
                >
                  {t('Participate')}
                </ButtonLink>
              </NotificationPanelActions>
            </NotificationPanelItem>
          );
        })}
      </NotificationPanelList>
    </NotificationPanel>
  );
};

export const ActiveDecisionsNotifications = () => {
  return (
    <ErrorBoundary fallback={null}>
      <Suspense fallback={null}>
        <ActiveDecisionsNotificationsSuspense />
      </Suspense>
    </ErrorBoundary>
  );
};

const RevisionRequestIcon = () => (
  <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary-orange2/10 text-primary-orange2">
    <LuPenLine className="size-6" />
  </div>
);

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

  const { proposal, revisionRequest } = item;
  const title = proposal.profile.name;
  const editHref = `/decisions/${item.decisionProfileSlug}/proposal/${proposal.profileId}/edit?reviewRevision=${revisionRequest.id}`;

  return (
    <NotificationPanelItem>
      <ProfileItem
        avatar={<RevisionRequestIcon />}
        title={t('Revision Request')}
        description={t('A reviewer has requested changes to {proposalName}', {
          proposalName: title,
        })}
      />
      <NotificationPanelActions>
        <Button
          size="small"
          color="secondary"
          className="w-full sm:w-auto"
          onPress={() => setDismissed(true)}
        >
          {t('Ignore')}
        </Button>
        <ButtonLink
          size="small"
          className="w-full sm:w-auto"
          href={editHref}
          onPress={() => setNavigating(true)}
          isLoading={navigating}
        >
          {t('Revise proposal')}
        </ButtonLink>
      </NotificationPanelActions>
    </NotificationPanelItem>
  );
};
