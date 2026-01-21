'use client';

import type { RouterOutput } from '@op/api/client';
import { trpc } from '@op/api/client';
import { Avatar } from '@op/ui/Avatar';
import { IconButton } from '@op/ui/IconButton';
import { Menu, MenuItem, MenuTrigger } from '@op/ui/Menu';
import { Popover } from '@op/ui/Popover';
import { toast } from '@op/ui/Toast';
import {
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from '@op/ui/ui/table';
import { LuEllipsis } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';
import { Link } from '@/lib/i18n/routing';

import { DecisionMemberRoleSelect } from './DecisionMemberRoleSelect';

// Infer the Member type from the tRPC router output
type Member = RouterOutput['profile']['listUsers'][number];

const MemberActionsMenu = ({
  member,
  profileId,
}: {
  member: Member;
  profileId: string;
}) => {
  const t = useTranslations();
  const utils = trpc.useUtils();

  const removeMember = trpc.profile.removeUser.useMutation({
    onSuccess: () => {
      toast.success({ message: t('Member removed successfully') });
      void utils.profile.listUsers.invalidate({ profileId });
    },
    onError: (error) => {
      toast.error({
        message: error.message || t('Failed to remove member'),
      });
    },
  });

  const handleRemove = () => {
    if (confirm(t('Are you sure you want to remove this member?'))) {
      removeMember.mutate({ profileUserId: member.id });
    }
  };

  return (
    <MenuTrigger>
      <IconButton
        variant="ghost"
        size="small"
        className="aria-expanded:bg-neutral-gray1"
      >
        <LuEllipsis className="size-4" />
      </IconButton>
      <Popover placement="bottom end">
        <Menu className="min-w-48 p-2">
          <MenuItem
            key="remove"
            onAction={handleRemove}
            className="px-3 py-1 text-functional-red"
          >
            {t('Remove member')}
          </MenuItem>
        </Menu>
      </Popover>
    </MenuTrigger>
  );
};

export const DecisionMembersTable = ({
  members,
  profileId,
}: {
  members: Member[];
  profileId: string;
}) => {
  const t = useTranslations();

  const columns = [
    { id: 'name', name: t('Name') },
    { id: 'email', name: t('Email') },
    { id: 'role', name: t('Role') },
    { id: 'actions', name: '' },
  ];

  return (
    <div className="overflow-hidden rounded-lg border border-neutral-gray2 bg-white">
      <Table aria-label={t('Members list')}>
        <TableHeader columns={columns}>
          {(column) => (
            <TableColumn
              key={column.id}
              isRowHeader={column.id === 'name'}
              className={column.id === 'actions' ? 'w-16' : undefined}
            >
              {column.name}
            </TableColumn>
          )}
        </TableHeader>
        <TableBody items={members}>
          {(member) => {
            const displayName =
              member.profile?.name || member.name || member.email.split('@')[0];
            const profileSlug = member.profile?.slug;
            const profileType = member.profile?.type;
            const currentRole = member.roles[0];

            return (
              <TableRow key={member.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar
                      placeholder={displayName || member.email}
                      className="size-8"
                    >
                      {member.profile?.avatarImage && (
                        <img
                          src={`/api/attachments/${member.profile.avatarImage.id}`}
                          alt={displayName || member.email}
                          className="size-full object-cover"
                        />
                      )}
                    </Avatar>
                    <div className="flex flex-col">
                      {profileSlug ? (
                        <Link
                          href={
                            profileType === 'org'
                              ? `/org/${profileSlug}`
                              : `/profile/${profileSlug}`
                          }
                          className="font-medium text-neutral-black hover:text-primary-teal"
                        >
                          {displayName}
                        </Link>
                      ) : (
                        <span className="font-medium text-neutral-black">
                          {displayName}
                        </span>
                      )}
                      {member.createdAt && (
                        <span className="text-xs text-neutral-gray4">
                          {t('Joined')}{' '}
                          {new Date(member.createdAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <span className="text-neutral-charcoal">{member.email}</span>
                </TableCell>
                <TableCell>
                  <DecisionMemberRoleSelect
                    memberId={member.id}
                    currentRoleId={currentRole?.id}
                    profileId={profileId}
                  />
                </TableCell>
                <TableCell>
                  <MemberActionsMenu member={member} profileId={profileId} />
                </TableCell>
              </TableRow>
            );
          }}
        </TableBody>
      </Table>
    </div>
  );
};
