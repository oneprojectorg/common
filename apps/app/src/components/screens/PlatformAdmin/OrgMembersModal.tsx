'use client';

import type { AdminOrg } from '@op/api/encoders';
import { Avatar, AvatarFallback } from '@op/sense/Avatar';
import { Badge } from '@op/sense/Badge';
import { Card } from '@op/sense/Card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@op/sense/Dialog';
import { ProfileItem } from '@op/sense/ProfileItem';
import { LuUsers } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

type Member = AdminOrg['members'][number];

export const OrgMembersModal = ({
  org,
  isOpen,
  onOpenChange,
}: {
  org: AdminOrg;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}) => {
  const t = useTranslations();
  const members = org.members ?? [];
  const orgName = org.profile?.name ?? t('Unknown organization');

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('Members of {orgName}', { orgName })}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 px-6 py-4">
          {/* Organization Info */}
          <div className="rounded-lg bg-muted p-4">
            <ProfileItem
              avatar={
                <Avatar size="lg">
                  <AvatarFallback name={orgName} />
                </Avatar>
              }
              title={orgName}
              description={org.domain ?? undefined}
            />
          </div>

          {/* Members List */}
          {members.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-muted">
                <LuUsers className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">
                {t('No members found')}
              </p>
            </div>
          ) : (
            <div>
              <div className="mb-2 text-sm font-medium">
                {t('Members')} ({members.length})
              </div>
              <div className="space-y-2">
                {members.map((member) => (
                  <MemberRow key={member.id} member={member} />
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

const MemberRow = ({ member }: { member: Member }) => {
  const t = useTranslations();
  const displayName = member.name ?? member.email;
  const roles =
    member.roles && member.roles.length > 0
      ? member.roles.map((r) => r.accessRole.name)
      : [t('No roles')];

  return (
    <Card className="flex-row items-center gap-3 p-3">
      <div className="min-w-0 flex-1">
        <ProfileItem
          avatar={
            <Avatar size="lg">
              <AvatarFallback name={displayName} />
            </Avatar>
          }
          title={displayName}
          description={member.name ? member.email : undefined}
        />
      </div>
      <div className="flex shrink-0 gap-1">
        {roles.map((role) => (
          <Badge key={role} variant="secondary">
            {role}
          </Badge>
        ))}
      </div>
    </Card>
  );
};
