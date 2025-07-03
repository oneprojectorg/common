'use client';

import { useUser } from '@/utils/UserProvider';
import { analyzeError, useConnectionStatus } from '@/utils/connectionErrors';
import { trpc } from '@op/api/client';
import { Button } from '@op/ui/Button';
import { DialogTrigger } from '@op/ui/Dialog';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '@op/ui/Modal';
import { Select, SelectItem } from '@op/ui/Select';
import { Tag, TagGroup } from '@op/ui/TagGroup';
import { toast } from '@op/ui/Toast';
import { useEffect, useState } from 'react';
import { LuUserPlus, LuX } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { InviteSuccessModal } from '../InviteSuccessModal';

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
  const [emailBadges, setEmailBadges] = useState<string[]>([]);
  const [selectedRole, setSelectedRole] = useState('Admin');
  const [selectedOrganization, setSelectedOrganization] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [lastInvitedEmail, setLastInvitedEmail] = useState('');
  const t = useTranslations();
  const { user } = useUser();
  const isOnline = useConnectionStatus();

  // Initialize selected organization when user data is available
  useEffect(() => {
    if (user?.currentOrganization?.id && !selectedOrganization) {
      setSelectedOrganization(user.currentOrganization.id);
    }
  }, [user?.currentOrganization?.id, selectedOrganization]);

  const addEmailBadge = (email: string) => {
    const trimmedEmail = email.trim();
    if (
      trimmedEmail &&
      trimmedEmail.includes('@') &&
      !emailBadges.includes(trimmedEmail)
    ) {
      setEmailBadges([...emailBadges, trimmedEmail]);
    }
  };

  const removeEmailBadge = (emailToRemove: string) => {
    setEmailBadges(emailBadges.filter((email) => email !== emailToRemove));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === ',' || e.key === 'Enter') {
      e.preventDefault();
      if (emails.trim()) {
        addEmailBadge(emails.trim());
        setEmails('');
      }
    }
  };

  const inviteUser = trpc.organization.invite.useMutation({
    onSuccess: () => {
      // Store the first invited email for display in success modal
      const allEmails = [...emailBadges];
      if (emails.trim()) {
        allEmails.push(emails.trim());
      }

      if (allEmails.length > 0) {
        setLastInvitedEmail(allEmails[0] || '');
      }

      setEmails('');
      setEmailBadges([]);
      setIsModalOpen(false);
      setIsSuccessModalOpen(true);
    },
    onError: (error) => {
      console.error('Failed to send invite:', error.message);

      const errorInfo = analyzeError(error);

      if (errorInfo.isConnectionError) {
        toast.error({
          title: 'Connection issue',
          message: errorInfo.message + ' Please try sending the invite again.',
        });
      } else {
        toast.error({
          title: 'Failed to send invite',
          message: errorInfo.message,
        });
      }
    },
  });

  const sendInvite = (
    emailList: string[],
    role: string,
    organizationId: string,
  ) => {
    if (!isOnline) {
      toast.error({
        title: 'No connection',
        message: 'Please check your internet connection and try again.',
      });
      return;
    }

    const inviteData = {
      emails: emailList,
      role,
      organizationId,
    };

    inviteUser.mutate(inviteData);
  };

  const handleSendInvite = () => {
    const allEmails = [...emailBadges];
    if (emails.trim()) {
      allEmails.push(emails.trim());
    }

    if (allEmails.length > 0) {
      sendInvite(allEmails, selectedRole, selectedOrganization);
    }
  };

  const triggerButton = children || (
    <Button color="secondary" variant="icon" className={className}>
      <LuUserPlus className="min-h-4 min-w-4" />
      <div className="text-nowrap">{t('Invite users')}</div>
    </Button>
  );

  return (
    <>
      <DialogTrigger isOpen={isModalOpen} onOpenChange={setIsModalOpen}>
        {triggerButton}
        <Modal
          isDismissable
          className="h-svh max-h-none w-screen max-w-none overflow-y-auto sm:h-auto"
        >
          <ModalHeader className="flex items-center justify-between">
            {/* Desktop header */}
            <div className="hidden sm:flex sm:w-full sm:items-center sm:justify-between">
              {t('Invite others to Common')}
              <LuX
                className="size-6 cursor-pointer stroke-1"
                onClick={() => setIsModalOpen(false)}
              />
            </div>

            {/* Mobile header */}
            <div className="flex w-full items-center justify-between sm:hidden">
              <Button
                unstyled
                onPress={() => {
                  setEmails('');
                  setEmailBadges([]);
                  setIsModalOpen(false);
                }}
                isDisabled={inviteUser.isPending}
              >
                {t('Cancel')}
              </Button>
              <h2>{t('Invite others to Common')}</h2>
              <Button
                unstyled
                onPress={handleSendInvite}
                isDisabled={
                  (!emails.trim() && emailBadges.length === 0) ||
                  inviteUser.isPending
                }
              >
                {inviteUser.isPending ? t('Sending...') : t('Send')}
              </Button>
            </div>
          </ModalHeader>
          <ModalBody className="gap-6 p-6">
            <p>
              {t('Expand your network and collaborate with others on Common.')}
            </p>

            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium">{t('Send to')}</label>
                <div className="flex min-h-[80px] flex-wrap gap-2 rounded-md border border-gray-300 p-2">
                  <TagGroup>
                    {emailBadges.map((email, index) => (
                      <Tag className="sm:rounded-sm" key={index}>
                        {email}
                        <button onClick={() => removeEmailBadge(email)}>
                          <LuX className="size-3" />
                        </button>
                      </Tag>
                    ))}
                  </TagGroup>
                  <textarea
                    value={emails}
                    onChange={(e) => setEmails(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={
                      emailBadges.length === 0
                        ? `name1@${user?.currentOrganization?.domain || 'example.org'}, name2@${user?.currentOrganization?.domain || 'example.org'}, ...`
                        : 'Type email and press comma or enter...'
                    }
                    className="min-w-[200px] flex-1 resize-none border-none pt-1 outline-none"
                    rows={1}
                  />
                </div>
              </div>

              <Select
                label={t('Add to organization')}
                selectedKey={selectedOrganization}
                onSelectionChange={(key) =>
                  setSelectedOrganization(key as string)
                }
              >
                {user?.currentOrganization && (
                  <SelectItem id={user.currentOrganization.id}>
                    {user.currentOrganization.profile?.name}
                  </SelectItem>
                )}
              </Select>

              <Select
                label={t('Role')}
                selectedKey={selectedRole}
                onSelectionChange={(key) => setSelectedRole(key as string)}
              >
                <SelectItem id="Admin">{t('Admin')}</SelectItem>
              </Select>
            </div>
          </ModalBody>
          {/* Desktop footer - hidden on mobile since actions are in header */}
          <ModalFooter className="hidden sm:flex">
            <Button
              color="primary"
              onPress={handleSendInvite}
              isDisabled={
                (!emails.trim() && emailBadges.length === 0) ||
                inviteUser.isPending
              }
            >
              {inviteUser.isPending ? t('Sending...') : t('Send')}
            </Button>
          </ModalFooter>
        </Modal>
      </DialogTrigger>

      <InviteSuccessModal
        isOpen={isSuccessModalOpen}
        onClose={() => setIsSuccessModalOpen(false)}
        onInviteMore={() => {
          setIsSuccessModalOpen(false);
          setIsModalOpen(true);
        }}
        invitedEmail={lastInvitedEmail}
        organizationName={
          user?.currentOrganization?.profile?.name || 'Solidarity Seeds'
        }
      />
    </>
  );
};
