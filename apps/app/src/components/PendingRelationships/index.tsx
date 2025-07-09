'use client';

import { trpc } from '@op/api/client';
import { relationshipMap } from '@op/types/relationships';
import { Button } from '@op/ui/Button';
import { Header2 } from '@op/ui/Header';
import { LoadingSpinner } from '@op/ui/LoadingSpinner';
import { Surface } from '@op/ui/Surface';
import { Suspense, useState } from 'react';

import ErrorBoundary from '../ErrorBoundary';
import { OrganizationAvatar } from '../OrganizationAvatar';

const PendingRelationshipsSuspense = ({ slug }: { slug: string }) => {
  const [organization] = trpc.organization.getBySlug.useSuspenseQuery({
    slug,
  });

  const [{ organizations, count }] =
    trpc.organization.listPendingRelationships.useSuspenseQuery();

  const [acceptedRelationships, setAcceptedRelationships] = useState<
    Set<string>
  >(new Set());

  const utils = trpc.useUtils();
  const remove = trpc.organization.declineRelationship.useMutation({
    onSuccess: () => {
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

  return count > 0 ? (
    <Surface className="flex flex-col gap-0 border-b">
      <Header2 className="flex items-center gap-1 p-6 font-serif text-title-sm text-neutral-black">
        Relationship Requests{' '}
        <span className="flex size-4 items-center justify-center rounded-full bg-functional-red font-sans text-xs text-neutral-offWhite">
          {count}
        </span>
      </Header2>
      <ul className="flex flex-col">
        {organizations.map((org) => {
          const relationships = org.relationships
            ?.filter((r) => r.pending)
            .map((r) => relationshipMap[r.relationshipType]?.noun)
            .join(', ');

          const relationshipKey = `${org.id}-${organization.id}`;
          const isAccepted = acceptedRelationships.has(relationshipKey);
          const isPending =
            approve.isPending &&
            approve.variables?.sourceOrganizationId === org.id;

          return (
            <li
              key={org.id}
              className={`flex flex-col justify-between gap-6 border-t p-6 transition-colors sm:flex-row sm:items-center sm:gap-2 ${isAccepted ? 'bg-primary-tealWhite' : ''}`}
            >
              <div className="flex items-center gap-3">
                <OrganizationAvatar organization={org} />
                <div className="flex h-full flex-col">
                  <span className="font-bold">
                    {org.profile.name}
                    {isAccepted ? (
                      <>
                        <span className="font-normal">
                          {' '}
                          will now appear as a
                        </span>{' '}
                        {relationships ?? 'related organization'}{' '}
                        <span className="font-normal"> on your profile.</span>
                      </>
                    ) : null}
                  </span>
                  {!isAccepted ? (
                    <span>
                      Added you as a {relationships ?? 'related organization'}
                    </span>
                  ) : null}
                </div>
              </div>
              <div className="flex items-center gap-4">
                {!isAccepted ? (
                  <>
                    <Button
                      color="secondary"
                      size="small"
                      className="w-full sm:w-auto"
                      onPress={() =>
                        remove.mutate({
                          sourceOrganizationId: org.id,
                          targetOrganizationId: organization.id,
                        })
                      }
                      isDisabled={isPending}
                    >
                      Decline
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
                      {isPending ? <LoadingSpinner /> : 'Accept'}
                    </Button>
                  </>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </Surface>
  ) : null;
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
