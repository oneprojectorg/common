'use client';

import type { AdminOrg } from '@op/api/encoders';
import { Avatar } from '@op/ui/Avatar';
import { Chip } from '@op/ui/Chip';
import { Modal, ModalBody, ModalHeader } from '@op/ui/Modal';
import { ProfileItem } from '@op/ui/ProfileItem';
import { Surface } from '@op/ui/Surface';
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
    <Modal isOpen={isOpen} onOpenChange={onOpenChange} isDismissable>
      <ModalHeader>{t('Members of {orgName}', { orgName })}</ModalHeader>
      <ModalBody className="space-y-4 pb-6">
        {/* Organization Info */}
        <div className="bg-neutral-gray0 rounded-lg p-4">
          <ProfileItem
            avatar={
              <Avatar placeholder={orgName} className="size-10 shrink-0" />
            }
            title={orgName}
            description={org.domain ?? undefined}
          />
        </div>

        {/* Members List */}
        {members.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-neutral-gray1">
              <LuUsers className="h-6 w-6 text-neutral-gray4" />
            </div>
            <p className="text-sm text-neutral-charcoal">
              {t('No members found')}
            </p>
          </div>
        ) : (
          <div>
            <div className="mb-2 text-sm font-medium text-neutral-black">
              {t('Members')} ({members.length})
            </div>
            <div className="space-y-2">
              {members.map((member) => (
                <MemberRow key={member.id} member={member} />
              ))}
            </div>
          </div>
        )}
      </ModalBody>
    </Modal>
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
    <Surface className="flex items-center gap-3 p-3">
      <div className="min-w-0 flex-1">
        <ProfileItem
          avatar={
            <Avatar placeholder={displayName} className="size-10 shrink-0" />
          }
          title={displayName}
          description={member.name ? member.email : undefined}
        />
      </div>
      <div className="flex shrink-0 gap-1">
        {roles.map((role) => (
          <Chip key={role}>{role}</Chip>
        ))}
      </div>
    </Surface>
  );
};
