'use client';

import { useUser } from '@/utils/UserProvider';
import { trpc } from '@op/api/client';
import { Button } from '@op/ui/Button';
import { DialogTrigger } from '@op/ui/Dialog';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '@op/ui/Modal';
import { Select, SelectItem } from '@op/ui/Select';
import { TextField } from '@op/ui/TextField';
import { useState } from 'react';
import { LuSend, LuUserPlus, LuX } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

interface InviteUserModalProps {
  /** Custom className for the default trigger button (minimal styling recommended) */
  className?: string;
  /** Custom trigger element. If not provided, uses default invite button with neutral styling */
  children?: React.ReactNode;
}

export const InviteUserModal = ({
  className,
  children,
}: InviteUserModalProps) => {
  const [emails, setEmails] = useState('');
  const [selectedRole, setSelectedRole] = useState('Admin');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const t = useTranslations();
  const { user } = useUser();

  const inviteUser = trpc.organization.invite.useMutation({
    onSuccess: () => {
      setEmails('');
      setIsModalOpen(false);
    },
    onError: (error) => {
      console.error('Failed to send invite:', error.message);
    },
  });

  const handleSendInvite = () => {
    if (emails.trim()) {
      // Parse multiple emails from textarea
      const emailList = emails
        .split(/[,\n\r\s]+/)
        .map((email) => email.trim())
        .filter((email) => email && email.includes('@'));

      if (emailList.length > 0) {
        inviteUser.mutate({
          emails: emailList,
          role: selectedRole,
        });
      }
    }
  };

  const triggerButton = children || (
    <Button color="secondary" variant="icon" className={className}>
      <LuUserPlus className="min-h-4 min-w-4" />
      <div className="text-nowrap">{t('Invite users')}</div>
    </Button>
  );

  return (
    <DialogTrigger isOpen={isModalOpen} onOpenChange={setIsModalOpen}>
      {triggerButton}
      <Modal>
        <ModalHeader className="flex items-center justify-between">
          {t('Invite others to Common')}
          <LuX
            className="size-6 cursor-pointer stroke-1"
            onClick={() => setIsModalOpen(false)}
          />
        </ModalHeader>
        <ModalBody>
          <p>
            {t(
              "Currently, only people with email addresses from your organization's domain can be invited (e.g., @{domain}).",
              {
                domain:
                  user?.currentOrganization?.profile?.email?.split('@')[1] ||
                  'example.org',
              },
            )}
          </p>

          <TextField
            label={t('Send to')}
            value={emails}
            onChange={setEmails}
            useTextArea={true}
            textareaProps={{
              rows: 3,
              placeholder: `name1@${user?.currentOrganization?.profile?.email?.split('@')[1] || 'example.org'}, name2@${user?.currentOrganization?.profile?.email?.split('@')[1] || 'example.org'}, ...`,
            }}
          />

          <div>
            <label>{t('Add to organization')}</label>
            <p>{user?.currentOrganization?.profile?.name}</p>
          </div>

          <Select
            label={t('Role')}
            selectedKey={selectedRole}
            onSelectionChange={(key) => setSelectedRole(key as string)}
          >
            <SelectItem id="Admin">{t('Admin')}</SelectItem>
          </Select>

          {inviteUser.error && <p>{inviteUser.error.message}</p>}
        </ModalBody>
        <ModalFooter>
          <Button
            color="secondary"
            surface="outline"
            onPress={() => {
              setEmails('');
              setIsModalOpen(false);
            }}
            isDisabled={inviteUser.isPending}
          >
            {t('Cancel')}
          </Button>
          <Button
            color="primary"
            onPress={handleSendInvite}
            isDisabled={!emails.trim() || inviteUser.isPending}
          >
            <LuSend />
            {inviteUser.isPending ? t('Sending...') : t('Send')}
          </Button>
        </ModalFooter>
      </Modal>
    </DialogTrigger>
  );
};
