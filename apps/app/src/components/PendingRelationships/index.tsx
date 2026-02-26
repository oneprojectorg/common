'use client';

import { skipBatch, trpc } from '@op/api/client';
import { relationshipMap } from '@op/types/relationships';
import { Button } from '@op/ui/Button';
import { LoadingSpinner } from '@op/ui/LoadingSpinner';
import {
  NotificationPanel,
  NotificationPanelActions,
  NotificationPanelHeader,
  NotificationPanelItem,
  NotificationPanelList,
} from '@op/ui/NotificationPanel';
import { Suspense, useState } from 'react';

import { useTranslations } from '@/lib/i18n';

import ErrorBoundary from '../ErrorBoundary';
import { OrganizationAvatar } from '../OrganizationAvatar';

const PendingRelationshipsSuspense = ({ slug }: { slug: string }) => {
  const t = useTranslations();
  const [organization] = trpc.organization.getBySlug.useSuspenseQuery({
    slug,
  });

  const [{ organizations, count }] =
    trpc.organization.listPendingRelationships.useSuspenseQuery(undefined, {
      ...skipBatch,
    });

  const [acceptedRelationships, setAcceptedRelationships] = useState<
    Set<string>
  >(new Set());

  const utils = trpc.useUtils();
  const remove = trpc.organization.declineRelationship.useMutation({
    onSuccess: () => {
      utils.organization.invalidate();
      utils.organization.listPendingRelationships.invalidate();
    },
  });
  const approve = trpc.organization.approveRelationship.useMutation({
    onSuccess: (_, variables) => {
      const relationshipKey = `${variables.sourceOrganizationId}-${variables.targetOrganizationId}`;
      setAcceptedRelationships((prev) => new Set(prev).add(relationshipKey));

      utils.organization.listPosts.invalidate();

      // invalidate so we remove it from the list.
      setTimeout(() => {
        utils.organization.invalidate();
        utils.organization.listPendingRelationships.invalidate();
      }, 5_000);
    },
  });

  if (count === 0) {
    return null;
  }

  return (
    <NotificationPanel>
      <NotificationPanelHeader
        title={t('Relationship Requests')}
        count={count}
      />
      <NotificationPanelList>
        {organizations.map((org) => {
          const relationships = org.relationships
            ?.filter((r) => r.pending)
            .map((r) => relationshipMap[r.relationshipType]?.noun)
            .join(', ');

          const relationshipKey = `${org.id}-${organization.id}`;
          const isAccepted = acceptedRelationships.has(relationshipKey);
          const isPending =
            (approve.isPending &&
              approve.variables?.sourceOrganizationId === org.id) ||
            remove.isPending;

          return (
            <NotificationPanelItem
              key={org.id}
              className={isAccepted ? 'bg-primary-tealWhite' : ''}
            >
              <div className="flex items-center gap-3">
                <OrganizationAvatar profile={org.profile} />
                <div className="flex h-full flex-col">
                  <span className="font-bold">
                    {org.profile.name}
                    {isAccepted ? (
                      <>
                        <span className="font-normal">
                          {' '}
                          {t('will now appear as a')}
                        </span>{' '}
                        {relationships ?? t('related organization')}{' '}
                        <span className="font-normal">
                          {' '}
                          {t('on your profile.')}
                        </span>
                      </>
                    ) : null}
                  </span>
                  {!isAccepted ? (
                    <span>
                      {t('Added you as a')}{' '}
                      {relationships ?? t('related organization')}
                    </span>
                  ) : null}
                </div>
              </div>
              <NotificationPanelActions>
                {!isAccepted ? (
                  <>
                    <Button
                      color="secondary"
                      size="small"
                      className="w-full sm:w-auto"
                      onPress={() => {
                        remove.mutate({
                          targetOrganizationId: organization.id,
                          ids: org.relationships?.map((r) => r.id) ?? [],
                        });
                      }}
                      isDisabled={isPending}
                    >
                      {remove.isPending ? <LoadingSpinner /> : t('Decline')}
                    </Button>
                    <Button
                      size="small"
                      className="w-full sm:w-auto"
                      onPress={() =>
                        approve.mutate({
                          sourceOrganizationId: org.id,
                          targetOrganizationId: organization.id,
                        })
                      }
                      isDisabled={isPending}
                    >
                      {approve.isPending ? <LoadingSpinner /> : t('Accept')}
                    </Button>
                  </>
                ) : null}
              </NotificationPanelActions>
            </NotificationPanelItem>
          );
        })}
      </NotificationPanelList>
    </NotificationPanel>
  );
};

export const PendingRelationships = (props: { slug: string }) => {
  // Don't show a skeleton loader as it will shift the layout and there might not be any pending relationships. Nicer to shift if there are pending
  return (
    <ErrorBoundary fallback={null}>
      <Suspense fallback={null}>
        <PendingRelationshipsSuspense {...props} />
      </Suspense>
    </ErrorBoundary>
  );
};
