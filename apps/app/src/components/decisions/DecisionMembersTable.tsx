'use client';

import type { RouterOutput } from '@op/api/client';
import {
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from '@op/ui/ui/table';

import { ProfileAvatar } from '@/components/ProfileAvatar';
import { useTranslations } from '@/lib/i18n';

import { DecisionMemberRoleSelect } from './DecisionMemberRoleSelect';

// Infer the Member type from the tRPC router output
type Member = RouterOutput['profile']['listUsers'][number];

const getMemberStatus = (member: Member): string => {
  // Check for status field if available, otherwise derive from data
  if ('status' in member && typeof member.status === 'string') {
    // Capitalize first letter
    return member.status.charAt(0).toUpperCase() + member.status.slice(1);
  }
  // Default to "Active" for existing members
  return 'Active';
};

export const DecisionMembersTable = ({
  members,
  profileId,
}: {
  members: Member[];
  profileId: string;
}) => {
  const t = useTranslations();

  return (
    <Table aria-label={t('Members list')} className="w-full table-fixed">
      <TableHeader>
        <TableColumn isRowHeader className="w-[200px]">
          {t('Name')}
        </TableColumn>
        <TableColumn className="w-auto">{t('Email')}</TableColumn>
        <TableColumn className="w-[140px] text-right">{t('Role')}</TableColumn>
      </TableHeader>
      <TableBody>
        {members.map((member) => {
          const displayName =
            member.profile?.name || member.name || member.email.split('@')[0];
          const currentRole = member.roles[0];
          const status = getMemberStatus(member);

          return (
            <TableRow key={member.id} id={member.id}>
              <TableCell>
                <div className="flex items-center gap-2">
                  <ProfileAvatar profile={member.profile} withLink={false} />
                  <div className="flex flex-col">
                    <span className="text-sm text-neutral-black">
                      {displayName}
                    </span>
                    <span className="text-xs text-neutral-gray4">{status}</span>
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <span className="text-sm text-neutral-black">
                  {member.email}
                </span>
              </TableCell>
              <TableCell className="text-right">
                <DecisionMemberRoleSelect
                  memberId={member.id}
                  currentRoleId={currentRole?.id}
                  profileId={profileId}
                />
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
};
