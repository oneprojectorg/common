'use client';
import { skipBatch, useTRPC } from '@op/api/client';
import { Button } from '@op/sense/Button';
import {
  NotificationPanel,
  NotificationPanelActions,
  NotificationPanelHeader,
  NotificationPanelItem,
  NotificationPanelList,
} from '@op/sense/NotificationPanel';
import { relationshipMap } from '@op/types/relationships';
import { useSuspenseQuery } from '@tanstack/react-query';
import { useMutation } from '@tanstack/react-query';
import { useQueryClient } from '@tanstack/react-query';
import { Suspense, useState } from 'react';

import { useTranslations } from '@/lib/i18n';

import ErrorBoundary from '../ErrorBoundary';
import { OrganizationAvatar } from '../OrganizationAvatar';

const PendingRelationshipsSuspense = ({ slug }: { slug: string }) => {
  const trpc = useTRPC();
  const t = useTranslations();
  const { data: organization } = useSuspenseQuery(
    trpc.organization.getBySlug.queryOptions({
      slug,
    }),
  );

  const {
    data: { organizations, count },
  } = useSuspenseQuery(
    trpc.organization.listPendingRelationships.queryOptions(undefined, {
      ...skipBatch,
    }),
  );

  const [acceptedRelationships, setAcceptedRelationships] = useState<
    Set<string>
  >(new Set());

  const queryClient = useQueryClient();
  const remove = useMutation(
    trpc.organization.declineRelationship.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries(trpc.organization.pathFilter());
        queryClient.invalidateQueries(
          trpc.organization.listPendingRelationships.pathFilter(),
        );
      },
    }),
  );
  const approve = useMutation(
    trpc.organization.approveRelationship.mutationOptions({
      onSuccess: (_, variables) => {
        const relationshipKey = `${variables.sourceOrganizationId}-${variables.targetOrganizationId}`;
        setAcceptedRelationships((prev) => new Set(prev).add(relationshipKey));

        queryClient.invalidateQueries(trpc.organization.listPosts.pathFilter());

        // invalidate so we remove it from the list.
        setTimeout(() => {
          queryClient.invalidateQueries(trpc.organization.pathFilter());
          queryClient.invalidateQueries(
            trpc.organization.listPendingRelationships.pathFilter(),
          );
        }, 5_000);
      },
    }),
  );

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
              className={isAccepted ? 'bg-accent' : ''}
            >
              <div className="flex items-center gap-3">
                <OrganizationAvatar profile={org.profile} />
                <div className="flex h-full flex-col">
                  <span className="font-bold">
                    {org.profile.name}
                    {isAccepted ? (
                      <span className="font-normal">
                        {' '}
                        {t(
                          'will now appear as a {relationship} on your profile.',
                          {
                            relationship:
                              relationships ?? t('related organization'),
                          },
                        )}
                      </span>
                    ) : null}
                  </span>
                  {!isAccepted ? (
                    <span>
                      {t('Added you as a {relationship}', {
                        relationship:
                          relationships ?? t('related organization'),
                      })}
                    </span>
                  ) : null}
                </div>
              </div>
              <NotificationPanelActions>
                {!isAccepted ? (
                  <>
                    <Button
                      variant="outline"
                      className="w-full sm:w-auto"
                      onClick={() => {
                        remove.mutate({
                          targetOrganizationId: organization.id,
                          ids: org.relationships?.map((r) => r.id) ?? [],
                        });
                      }}
                      loading={remove.isPending}
                      disabled={isPending}
                    >
                      {t('Decline')}
                    </Button>
                    <Button
                      className="w-full sm:w-auto"
                      onClick={() =>
                        approve.mutate({
                          sourceOrganizationId: org.id,
                          targetOrganizationId: organization.id,
                        })
                      }
                      loading={approve.isPending}
                      disabled={isPending}
                    >
                      {t('Accept')}
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
