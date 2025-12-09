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
import { Suspense, useEffect, useState } from 'react';
import { LuUserPlus } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import ErrorBoundary from '../ErrorBoundary';
import { InviteSuccessModal } from '../InviteSuccessModal';
import { InviteNewOrganization } from './InviteNewOrganization';
import { InviteToExistingOrganization } from './InviteToExistingOrganization';
import { parseEmails } from './emailUtils';

export const InviteUserModal = ({
  children,
  isOpen: controlledIsOpen,
  onOpenChange: controlledOnOpenChange,
}: {
  children?: React.ReactNode;
  isOpen?: boolean;
  onOpenChange?: (isOpen: boolean) => void;
}) => {
  const [emails, setEmails] = useState('');
  const [emailBadges, setEmailBadges] = useState<string[]>([]);
  const [selectedRole, setSelectedRole] = useState('');
  const [selectedRoleId, setSelectedRoleId] = useState('');
  const [selectedOrganization, setSelectedOrganization] = useState('');
  const [personalMessage, setPersonalMessage] = useState('');
  const [internalIsModalOpen, setInternalIsModalOpen] = useState(false);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [lastInvitedEmail, setLastInvitedEmail] = useState('');
  const [invitedCount, setInvitedCount] = useState(0);
  const [activeTab, setActiveTab] = useState('existing');
  const t = useTranslations();
  const { user } = useUser();
  const isOnline = useConnectionStatus();

  const isModalOpen = controlledIsOpen ?? internalIsModalOpen;
  const setIsModalOpen = controlledOnOpenChange ?? setInternalIsModalOpen;

  const inviteUserEnabled =
    useFeatureFlagEnabled('invite_admin_user') ||
    user?.currentOrganization?.networkOrganization;

  const isOrg = user?.currentOrganization;

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

    // Parse the current input for emails
    if (emails.trim()) {
      const { emails: emailsFromInput } = parseEmails(emails);
      allEmails.push(...emailsFromInput);
    }

    if (allEmails.length > 0) {
      setLastInvitedEmail(allEmails[0] || '');
      setInvitedCount(allEmails.length);
    }

    setEmails('');
    setEmailBadges([]);
    setPersonalMessage('');
    setIsModalOpen(false);
    setIsSuccessModalOpen(true);
  };

  const handleInviteError = (error: any, title: string) => {
    console.error('Failed to send invite:', error.message);

    const errorInfo = analyzeError(error);

    if (errorInfo.isConnectionError) {
      toast.error({
        title: t('Connection issue'),
        message:
          errorInfo.message + ' ' + t('Please try sending the invite again.'),
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
    roleId?: string;
    organizationId?: string;
    message?: string;
  }) => {
    const { emails, roleId, organizationId, message } = props;

    if (!isOnline) {
      toast.error({
        title: t('No connection'),
        message: t('Please check your internet connection and try again.'),
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
      inviteData.roleId = roleId;
      inviteData.organizationId = organizationId;
    }

    inviteUser.mutate(inviteData);
  };

  const handleSendInvite = () => {
    const allEmails = [...emailBadges];

    // Parse the current input for emails
    if (emails.trim()) {
      const { emails: emailsFromInput } = parseEmails(emails);
      allEmails.push(...emailsFromInput);
    }

    if (allEmails.length === 0) {
      return;
    }

    // Check maximum number of emails (Resend batch limit)
    if (allEmails.length > 100) {
      toast.error({
        title: t('Too many emails'),
        message: t(
          'You can invite a maximum of 100 emails at once. Please reduce the number and try again.',
        ),
      });
      return;
    }

    // Validate all emails
    const invalidEmails = allEmails.filter((email) => !isValidEmail(email));

    if (invalidEmails.length > 0) {
      toast.error({
        title:
          invalidEmails.length === 1
            ? t('Invalid email address')
            : t('Invalid email addresses'),
        message: `${invalidEmails.join(', ')}`,
      });
      return;
    }

    if (activeTab === 'existing') {
      sendInvite({
        emails: allEmails,
        roleId: selectedRoleId,
        organizationId: selectedOrganization,
      });
    } else {
      // For new organization invites, we need to handle this differently
      // since roleId might not be applicable
      sendInvite({
        emails: allEmails,
        message: personalMessage,
      });
    }
  };

  const triggerButton = isOrg
    ? children || (
        <>
          <Button color="secondary" variant="icon" className="hidden sm:flex">
            <LuUserPlus className="min-h-4 min-w-4" />
            <div className="hidden text-nowrap md:block">
              {t('Invite users')}
            </div>
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
      )
    : null;

  return (
    <>
      <DialogTrigger isOpen={isModalOpen} onOpenChange={setIsModalOpen}>
        {controlledIsOpen === undefined ? triggerButton : null}
        <Modal isDismissable isOpen={isModalOpen} onOpenChange={setIsModalOpen}>
          <ModalHeader>{t('Invite others to Common')}</ModalHeader>
          <ErrorBoundary>
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

                <TabPanel id="existing" className="sm:p-0">
                  <Suspense
                    fallback={
                      <div className="animate-pulse">
                        {t('Loading roles...')}
                      </div>
                    }
                  >
                    <InviteToExistingOrganization
                      emails={emails}
                      setEmails={setEmails}
                      emailBadges={emailBadges}
                      setEmailBadges={setEmailBadges}
                      selectedRole={selectedRole}
                      setSelectedRole={setSelectedRole}
                      setSelectedRoleId={setSelectedRoleId}
                      selectedOrganization={selectedOrganization}
                      setSelectedOrganization={setSelectedOrganization}
                    />
                  </Suspense>
                </TabPanel>

                {inviteUserEnabled ? (
                  <TabPanel id="new" className="sm:p-0">
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
          </ErrorBoundary>
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
        invitedCount={invitedCount}
        organizationName={
          activeTab === 'existing'
            ? user?.currentProfile?.name || 'Common'
            : 'Common'
        }
      />
    </>
  );
};
