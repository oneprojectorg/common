import { trpc } from '@op/api/client';
import { Button } from '@op/ui/Button';
import { Header2 } from '@op/ui/Header';
import { Skeleton } from '@op/ui/Skeleton';
import { Surface } from '@op/ui/Surface';
import { Suspense } from 'react';

import ErrorBoundary from '../ErrorBoundary';
import { OrganizationAvatar } from '../OrganizationAvatar';

const PendingRelationshipsSuspense = ({ slug }: { slug: string }) => {
  const [organization] = trpc.organization.getBySlug.useSuspenseQuery({
    slug,
  });

  const [{ organizations, count }] =
    trpc.organization.listRelationships.useSuspenseQuery({
      organizationId: organization.id,
      pending: true,
    });

  const utils = trpc.useContext();
  const approve = trpc.organization.approveRelationship.useMutation({
    onSuccess: () => {
      utils.organization.listRelationships.invalidate();
      utils.organization.listPosts.invalidate();
    },
  });

  return (
    <Surface className="flex flex-col gap-0 border-b">
      <Header2 className="p-6 font-serif text-title-sm text-neutral-black">
        Relationship Requests {count}
      </Header2>
      <ul className="flex flex-col">
        {organizations.map((org) => {
          const relationships = org.relationships
            ?.filter((r) => r.pending)
            .map((r) => r.relationshipType)
            .join(', ');

          return (
            <li className="flex items-center justify-between border-t p-6">
              <div className="flex gap-3">
                <OrganizationAvatar organization={org} />
                <div className="flex flex-col">
                  <span className="font-bold">{org.name}</span>
                  <span>Added you as a {relationships ?? 'related'}</span>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <Button color="secondary" size="small">
                  Decline
                </Button>
                <Button
                  size="small"
                  onPress={() =>
                    approve.mutate({
                      targetOrganizationId: org.id,
                      organizationId: organization.id,
                    })
                  }
                >
                  Accept
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </Surface>
  );
};

export const PendingRelationships = (props: { slug: string }) => {
  return (
    <ErrorBoundary fallback={<div>Could not load pending reltionships</div>}>
      <Suspense fallback={<Skeleton />}>
        <PendingRelationshipsSuspense {...props} />
      </Suspense>
    </ErrorBoundary>
  );
};
