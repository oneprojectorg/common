'use client';

import { useRequiredUser } from '@/utils/UserProvider';
import { analyzeError, useConnectionStatus } from '@/utils/connectionErrors';
import { trpc } from '@op/api/client';
import type { Organization } from '@op/api/encoders';
import { Button } from '@op/sense/Button';
import { toast } from '@op/sense/Toast';
import { useState } from 'react';
import { LuCheck, LuUserPlus } from 'react-icons/lu';

import { OrganizationAvatar } from '@/components/OrganizationAvatar';

interface InviteToOrganizationButtonProps {
  profile: Organization;
}

export const InviteToOrganizationButton = ({
  profile,
}: InviteToOrganizationButtonProps) => {
  const { user } = useRequiredUser();
  const isOnline = useConnectionStatus();

  const [[rolesData, membershipData]] = trpc.useSuspenseQueries((t) => [
    t.organization.getRoles(),
    user.currentOrganization
      ? t.organization.checkMembership({
          email: profile.profile.email!,
          organizationId: user.currentOrganization?.id,
        })
      : {},
  ]);

  const [isMember, setIsMember] = useState(membershipData.isMember);

  const inviteUser = trpc.organization.invite.useMutation({
    onSuccess: (result) => {
      const successfulInvites = result.details?.successful || [];
      const failedInvites = result.details?.failed || [];

      // Check if user was successfully added to organization
      const wasAdded = successfulInvites.includes(profile.profile.email!);

      // Check if user is already a member (in failed array)
      const isMemberFailed = failedInvites.some(
        (failed) =>
          failed.email === profile.profile.email &&
          failed.reason.includes('already a member'),
      );

      if (wasAdded) {
        setIsMember(true);
        toast.success('Member added', {
          description: `${profile.profile.name || profile.profile.email} is now a member of ${user.currentProfile?.name}`,
        });
      } else if (isMemberFailed) {
        setIsMember(true);
        toast.success(' a member', {
          description: `${profile.profile.name || profile.profile.email} is already a member of ${user.currentProfile?.name}`,
        });
      } else {
        // Handle other failure cases
        const firstError = failedInvites[0]?.reason || 'Unknown error occurred';
        toast.error('Failed to send invite', {
          description: firstError,
        });
      }
    },
    onError: (error) => {
      const errorInfo = analyzeError(error);

      if (errorInfo.isConnectionError) {
        toast.error('Connection issue', {
          description:
            errorInfo.message + ' Please try sending the invite again.',
        });
      } else {
        toast.error('Failed to send invite', {
          description: errorInfo.message,
        });
      }
    },
  });

  const handleInvite = () => {
    if (!isOnline) {
      toast.error('No connection', {
        description: 'Please check your internet connection and try again.',
      });
      return;
    }

    if (!user.currentOrganization?.id) {
      toast.error('No organization', {
        description: 'You must be part of an organization to send invites.',
      });
      return;
    }

    // Find the Member role - throw error if not found
    const memberRole = rolesData.roles.find((role) => role.name === 'Member');
    if (!memberRole) {
      toast.error('System configuration error', {
        description: 'Member role not found. Please contact support.',
      });
      return;
    }

    inviteUser.mutate({
      emails: [profile.profile.email!],
      roleId: memberRole.id,
      organizationId: user.currentOrganization.id,
    });
  };

  if (isMember) {
    return (
      <Button variant="outline" disabled>
        <LuCheck className="size-4" />
        Member
      </Button>
    );
  }

  return user.currentProfile ? (
    <Button
      variant="outline"
      onClick={handleInvite}
      disabled={inviteUser.isPending}
      className="min-w-fit"
    >
      {inviteUser.isPending ? (
        'Inviting...'
      ) : (
        <>
          <LuUserPlus className="size-4" />
          Add to
        </>
      )}
      <OrganizationAvatar profile={user.currentProfile} className="size-6" />
    </Button>
  ) : null;
};
