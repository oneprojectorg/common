'use client';

import { trpc } from '@op/api/client';
import { Button } from '@op/ui/Button';
import { DialogTrigger } from '@op/ui/Dialog';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '@op/ui/Modal';
import { Select, SelectItem } from '@op/ui/Select';
import { TextField } from '@op/ui/TextField';
import { toast } from '@op/ui/Toast';
import { Suspense, useEffect, useState } from 'react';

import { useTranslations } from '@/lib/i18n';

const InviteForm = ({
  profileId,
  onSuccess,
}: {
  profileId: string;
  onSuccess: () => void;
}) => {
  const t = useTranslations();
  const utils = trpc.useUtils();

  const [email, setEmail] = useState('');
  const [selectedRoleId, setSelectedRoleId] = useState('');
  const [personalMessage, setPersonalMessage] = useState('');

  const [rolesData] = trpc.organization.getRoles.useSuspenseQuery();

  // Set default role to Member on mount
  useEffect(() => {
    if (!selectedRoleId && rolesData.roles.length > 0) {
      const memberRole = rolesData.roles.find(
        (role) => role.name.toLowerCase() === 'member',
      );
      const defaultRole = memberRole || rolesData.roles[0];
      if (defaultRole) {
        setSelectedRoleId(defaultRole.id);
      }
    }
  }, [selectedRoleId, rolesData.roles]);

  const inviteMember = trpc.profile.addUser.useMutation({
    onSuccess: () => {
      toast.success({ message: t('Invitation sent successfully') });
      void utils.profile.listUsers.invalidate({ profileId });
      setEmail('');
      setPersonalMessage('');
      onSuccess();
    },
    onError: (error) => {
      toast.error({
        message: error.message || t('Failed to send invitation'),
      });
    },
  });

  const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim());
  };

  const handleSubmit = () => {
    if (!email.trim()) {
      toast.error({ message: t('Please enter an email address') });
      return;
    }

    if (!isValidEmail(email)) {
      toast.error({ message: t('Please enter a valid email address') });
      return;
    }

    if (!selectedRoleId) {
      toast.error({ message: t('Please select a role') });
      return;
    }

    inviteMember.mutate({
      profileId,
      inviteeEmail: email.trim(),
      roleIdsToAssign: [selectedRoleId],
      personalMessage: personalMessage.trim() || undefined,
    });
  };

  return (
    <>
      <ModalBody className="flex flex-col gap-4 p-6">
        <p className="text-neutral-charcoal">
          {t('Invite someone to collaborate on this decision.')}
        </p>

        <TextField
          label={t('Email')}
          value={email}
          onChange={setEmail}
          type="email"
          isRequired
          inputProps={{ placeholder: t('Enter email address') }}
        />

        <Select
          label={t('Role')}
          selectedKey={selectedRoleId}
          onSelectionChange={(key) => setSelectedRoleId(key as string)}
        >
          {rolesData.roles.map((role) => (
            <SelectItem key={role.id} id={role.id}>
              {role.name}
            </SelectItem>
          ))}
        </Select>

        <TextField
          label={t('Personal message (optional)')}
          value={personalMessage}
          onChange={setPersonalMessage}
          inputProps={{
            placeholder: t('Add a personal note to your invitation'),
          }}
        />
      </ModalBody>
      <ModalFooter>
        <Button
          color="primary"
          className="w-full sm:w-fit"
          onPress={handleSubmit}
          isDisabled={
            !email.trim() || !selectedRoleId || inviteMember.isPending
          }
        >
          {inviteMember.isPending ? t('Sending...') : t('Send invitation')}
        </Button>
      </ModalFooter>
    </>
  );
};

export const InviteDecisionMemberModal = ({
  profileId,
  isOpen,
  onOpenChange,
}: {
  profileId: string;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}) => {
  const t = useTranslations();

  return (
    <DialogTrigger isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal isDismissable isOpen={isOpen} onOpenChange={onOpenChange}>
        <ModalHeader>{t('Invite member')}</ModalHeader>
        <Suspense
          fallback={
            <ModalBody className="p-6">
              <div className="animate-pulse">{t('Loading...')}</div>
            </ModalBody>
          }
        >
          <InviteForm
            profileId={profileId}
            onSuccess={() => onOpenChange(false)}
          />
        </Suspense>
      </Modal>
    </DialogTrigger>
  );
};
