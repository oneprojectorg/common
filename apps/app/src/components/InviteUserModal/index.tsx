'use client';

import { useUser } from '@/utils/UserProvider';
import { analyzeError, useConnectionStatus } from '@/utils/connectionErrors';
import { trpc } from '@op/api/client';
import { Button } from '@op/ui/Button';
import { DialogTrigger } from '@op/ui/Dialog';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '@op/ui/Modal';
import { Tab, TabList, TabPanel, Tabs } from '@op/ui/Tabs';
import { toast } from '@op/ui/Toast';
import { useFeatureFlagEnabled } from 'posthog-js/react';
import { useEffect, useState } from 'react';
import { LuUserPlus } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { InviteSuccessModal } from '../InviteSuccessModal';
import { InviteNewOrganization } from './InviteNewOrganization';
import { InviteToExistingOrganization } from './InviteToExistingOrganization';

interface InviteUserModalProps {
  children?: React.ReactNode;
}

export const InviteUserModal = ({ children }: InviteUserModalProps) => {
  const [emails, setEmails] = useState('');
  const [emailBadges, setEmailBadges] = useState<string[]>([]);
  const [selectedRole, setSelectedRole] = useState('Admin');
  const [selectedOrganization, setSelectedOrganization] = useState('');
  const [personalMessage, setPersonalMessage] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [lastInvitedEmail, setLastInvitedEmail] = useState('');
  const [activeTab, setActiveTab] = useState('existing');
  const t = useTranslations();
  const { user } = useUser();
  const isOnline = useConnectionStatus();

  const inviteUserEnabled =
    useFeatureFlagEnabled('invite_admin_user') ||
    user?.currentOrganization?.networkOrganization;

  // Initialize selected organization when user data is available
  useEffect(() => {
    if (user?.currentOrganization?.id && !selectedOrganization) {
      setSelectedOrganization(user.currentOrganization.id);
    }
  }, [user?.currentOrganization?.id, selectedOrganization]);

  const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim());
  };

  const inviteUser = trpc.organization.invite.useMutation({
    onSuccess: () => {
      handleInviteSuccess();
    },
    onError: (error) => {
      handleInviteError(error, 'Failed to send invite');
    },
  });

  const handleInviteSuccess = () => {
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
    setPersonalMessage('');
    setIsModalOpen(false);
    setIsSuccessModalOpen(true);
  };

  const handleInviteError = (error: any, title: string) => {
    console.error(title + ':', error.message);

    const errorInfo = analyzeError(error);

    if (errorInfo.isConnectionError) {
      toast.error({
        title: 'Connection issue',
        message: errorInfo.message + ' Please try sending the invite again.',
      });
    } else {
      toast.error({
        title,
        message: errorInfo.message,
      });
    }
  };

  const sendInvite = (props: {
    emails: string[];
    role: string;
    organizationId?: string;
    message?: string;
  }) => {
    const { emails, role, organizationId, message } = props;

    if (!isOnline) {
      toast.error({
        title: 'No connection',
        message: 'Please check your internet connection and try again.',
      });
      return;
    }

    const inviteData: any = {
      emails,
    };

    if (activeTab === 'new') {
      // New organization invite
      if (message) {
        inviteData.personalMessage = message;
      }
    } else {
      // Existing organization invite
      inviteData.role = role;
      inviteData.organizationId = organizationId;
    }

    inviteUser.mutate(inviteData);
  };

  const handleSendInvite = () => {
    const allEmails = [...emailBadges];
    if (emails.trim()) {
      allEmails.push(emails.trim());
    }

    if (allEmails.length === 0) {
      return;
    }

    // Validate all emails
    const invalidEmails = allEmails.filter((email) => !isValidEmail(email));

    if (invalidEmails.length > 0) {
      toast.error({
        title:
          invalidEmails.length === 1
            ? 'Invalid email address'
            : 'Invalid email addresses',
        message: `${invalidEmails.join(', ')}`,
      });
      return;
    }

    if (activeTab === 'existing') {
      sendInvite({
        emails: allEmails,
        role: selectedRole,
        organizationId: selectedOrganization,
      });
    } else {
      sendInvite({
        emails: allEmails,
        role: selectedRole,
        message: personalMessage,
      });
    }
  };

  const triggerButton = children || (
    <>
      <Button color="secondary" variant="icon" className="hidden sm:flex">
        <LuUserPlus className="min-h-4 min-w-4" />
        <div className="text-nowrap">{t('Invite users')}</div>
      </Button>
      <Button
        color="neutral"
        unstyled
        variant="icon"
        className="flex size-8 items-center justify-center rounded-full bg-neutral-offWhite sm:hidden"
      >
        <LuUserPlus className="min-h-4 min-w-4 text-neutral-gray4" />
      </Button>
    </>
  );

  return (
    <>
      <DialogTrigger isOpen={isModalOpen} onOpenChange={setIsModalOpen}>
        {triggerButton}
        <Modal isDismissable isOpen={isModalOpen} onOpenChange={setIsModalOpen}>
          <ModalHeader>{t('Invite others to Common')}</ModalHeader>
          <ModalBody className="h-auto gap-6 p-6">
            <Tabs
              selectedKey={activeTab}
              onSelectionChange={(key) => setActiveTab(key as string)}
            >
              <TabList aria-label="Invite options">
                <Tab id="existing">{t('Add to my organization')}</Tab>
                {inviteUserEnabled ? (
                  <Tab id="new">{t('Invite a new organization')}</Tab>
                ) : null}
              </TabList>

              <TabPanel id="existing">
                <InviteToExistingOrganization
                  emails={emails}
                  setEmails={setEmails}
                  emailBadges={emailBadges}
                  setEmailBadges={setEmailBadges}
                  selectedRole={selectedRole}
                  setSelectedRole={setSelectedRole}
                  selectedOrganization={selectedOrganization}
                  setSelectedOrganization={setSelectedOrganization}
                />
              </TabPanel>

              {inviteUserEnabled ? (
                <TabPanel id="new">
                  <InviteNewOrganization
                    emails={emails}
                    setEmails={setEmails}
                    emailBadges={emailBadges}
                    setEmailBadges={setEmailBadges}
                    personalMessage={personalMessage}
                    setPersonalMessage={setPersonalMessage}
                  />
                </TabPanel>
              ) : null}
            </Tabs>
          </ModalBody>
          <ModalFooter>
            <Button
              color="primary"
              className="w-full sm:w-fit"
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
          activeTab === 'existing'
            ? user?.currentProfile?.name || 'Common'
            : 'Common'
        }
      />
    </>
  );
};
