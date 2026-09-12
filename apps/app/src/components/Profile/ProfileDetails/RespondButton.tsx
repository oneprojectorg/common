'use client';
import { useRequiredUser } from '@/utils/UserProvider';
import { skipBatch, useTRPC } from '@op/api/client';
import { Organization } from '@op/api/encoders';
import { Button } from '@op/sense/Button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@op/sense/DropdownMenu';
import { toast } from '@op/sense/Toast';
import { useSuspenseQuery } from '@tanstack/react-query';
import { useMutation } from '@tanstack/react-query';
import { useQueryClient } from '@tanstack/react-query';
import { Suspense } from 'react';
import { LuCheck, LuUserPlus, LuX } from 'react-icons/lu';

import ErrorBoundary from '@/components/ErrorBoundary';

const RespondButtonSuspense = ({ profile }: { profile: Organization }) => {
  const trpc = useTRPC();
  const { user } = useRequiredUser();
  const queryClient = useQueryClient();

  if (!user.currentOrganization?.id) {
    return null;
  }

  // Get pending relationships FROM the profile TO our current organization
  const {
    data: { organizations: pendingOrgs },
  } = useSuspenseQuery(
    trpc.organization.listPendingRelationships.queryOptions(undefined, {
      ...skipBatch,
    }),
  );

  // Filter to only show requests from the profile we're viewing
  const pendingFromProfile = pendingOrgs.find((org) => org.id === profile.id);

  if (!pendingFromProfile?.relationships?.some((r) => r.pending)) {
    return null;
  }

  const approve = useMutation(
    trpc.organization.approveRelationship.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries(trpc.organization.pathFilter());
        queryClient.invalidateQueries(
          trpc.organization.listPendingRelationships.pathFilter(),
        );
        queryClient.invalidateQueries(
          trpc.organization.listDirectedRelationships.pathFilter(),
        );
        queryClient.invalidateQueries(
          trpc.organization.listRelationships.pathFilter(),
        );
        toast.success('Relationship approved');
      },
      onError: () => {
        toast.error('Could not approve relationship');
      },
    }),
  );

  const decline = useMutation(
    trpc.organization.declineRelationship.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries(trpc.organization.pathFilter());
        queryClient.invalidateQueries(
          trpc.organization.listPendingRelationships.pathFilter(),
        );
        queryClient.invalidateQueries(
          trpc.organization.listDirectedRelationships.pathFilter(),
        );
        queryClient.invalidateQueries(
          trpc.organization.listRelationships.pathFilter(),
        );
        toast.success('Relationship declined');
      },
      onError: () => {
        toast.error('Could not decline relationship');
      },
    }),
  );

  const handleApprove = () => {
    if (!user.currentOrganization?.id) return;

    approve.mutate({
      sourceOrganizationId: profile.id,
      targetOrganizationId: user.currentOrganization.id,
    });
  };

  const handleDecline = () => {
    if (!user.currentOrganization?.id || !pendingFromProfile?.relationships)
      return;

    decline.mutate({
      targetOrganizationId: user.currentOrganization.id,
      ids: pendingFromProfile.relationships
        .filter((r) => r.pending)
        .map((r) => r.id),
    });
  };

  const dropdownItems = [
    {
      id: 'accept',
      label: 'Accept',
      icon: <LuCheck className="size-4" />,
      onAction: handleApprove,
    },
    {
      id: 'decline',
      label: 'Decline',
      icon: <LuX className="size-4 text-destructive" />,
      onAction: handleDecline,
    },
  ];

  const isPending = approve.isPending || decline.isPending;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button loading={isPending} className="min-w-full sm:min-w-fit">
            <LuUserPlus className="size-4" />
            Respond
          </Button>
        }
      />
      <DropdownMenuContent align="start">
        {dropdownItems.map((item) => (
          <DropdownMenuItem key={item.id} onClick={item.onAction}>
            {item.icon}
            {item.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export const RespondButton = ({ profile }: { profile: Organization }) => {
  return (
    <ErrorBoundary fallback={null}>
      <Suspense fallback={null}>
        <RespondButtonSuspense profile={profile} />
      </Suspense>
    </ErrorBoundary>
  );
};
