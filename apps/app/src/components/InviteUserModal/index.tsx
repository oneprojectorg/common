'use client';

import { useRequiredUser } from '@/utils/UserProvider';
import { analyzeError, useConnectionStatus } from '@/utils/connectionErrors';
import { trpc } from '@op/api/client';
import { logger } from '@op/logging/client';
import { Button } from '@op/sense/Button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@op/sense/Dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@op/sense/Tabs';
import { toast } from '@op/sense/Toast';
import { useFeatureFlagEnabled } from 'posthog-js/react';
import { type ReactElement, Suspense, useEffect, useState } from 'react';
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
  const { user } = useRequiredUser();
  const isOnline = useConnectionStatus();

  const isModalOpen = controlledIsOpen ?? internalIsModalOpen;
  const setIsModalOpen = controlledOnOpenChange ?? setInternalIsModalOpen;

  const inviteUserEnabled =
    useFeatureFlagEnabled('invite_admin_user') ||
    user.currentOrganization?.networkOrganization;

  const isOrg = user.currentOrganization;

  // Initialize selected organization when user data is available
  useEffect(() => {
    if (user.currentOrganization?.id && !selectedOrganization) {
      setSelectedOrganization(user.currentOrganization.id);
    }
  }, [user.currentOrganization?.id, selectedOrganization]);

  const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim());
  };

  const inviteUser = trpc.organization.invite.useMutation({
    onSuccess: () => {
      handleInviteSuccess();
    },
    onError: (error) => {
      handleInviteError(error, t('Failed to send invite'));
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
    logger.error('Failed to send invite', {
      error,
      context: 'InviteUserModal.sendInvite',
    });

    const errorInfo = analyzeError(error);

    if (errorInfo.isConnectionError) {
      toast.error(t('Connection issue'), {
        description: t('Please try sending the invite again.'),
      });
    } else {
      toast.error(title, {
        description: errorInfo.message,
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
      toast.error(t('No connection'), {
        description: t('Please check your internet connection and try again.'),
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
      toast.error(t('Too many emails'), {
        description: t(
          'You can invite a maximum of 100 emails at once. Please reduce the number and try again.',
        ),
      });
      return;
    }

    // Validate all emails
    const invalidEmails = allEmails.filter((email) => !isValidEmail(email));

    if (invalidEmails.length > 0) {
      toast.error(
        invalidEmails.length === 1
          ? t('Invalid email address')
          : t('Invalid email addresses'),
        {
          description: `${invalidEmails.join(', ')}`,
        },
      );
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

  const defaultTriggers = (
    <>
      <DialogTrigger
        render={
          <Button variant="secondary" className="hidden sm:flex">
            <LuUserPlus className="min-h-4 min-w-4" />
            <span className="hidden text-nowrap md:block">
              {t('Invite users')}
            </span>
          </Button>
        }
      />
      <DialogTrigger
        render={
          <Button
            aria-label={t('Invite users')}
            variant="bare"
            className="flex size-8 items-center justify-center rounded-full bg-muted text-muted-foreground sm:hidden"
          >
            <LuUserPlus className="min-h-4 min-w-4" />
          </Button>
        }
      />
    </>
  );

  return (
    <>
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        {controlledIsOpen === undefined && isOrg ? (
          children ? (
            <DialogTrigger render={children as ReactElement} />
          ) : (
            defaultTriggers
          )
        ) : null}
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{t('Invite others to Common')}</DialogTitle>
          </DialogHeader>
          <ErrorBoundary>
            <div className="flex flex-col gap-6 p-6">
              <Tabs
                value={activeTab}
                onValueChange={(value) => setActiveTab(value as string)}
              >
                <TabsList aria-label={t('Invite options')}>
                  <TabsTrigger value="existing">
                    {t('Add to my organization')}
                  </TabsTrigger>
                  {inviteUserEnabled ? (
                    <TabsTrigger value="new">
                      {t('Invite a new organization')}
                    </TabsTrigger>
                  ) : null}
                </TabsList>

                <TabsContent value="existing" className="sm:p-0">
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
                </TabsContent>

                {inviteUserEnabled ? (
                  <TabsContent value="new" className="sm:p-0">
                    <InviteNewOrganization
                      emails={emails}
                      setEmails={setEmails}
                      emailBadges={emailBadges}
                      setEmailBadges={setEmailBadges}
                      personalMessage={personalMessage}
                      setPersonalMessage={setPersonalMessage}
                    />
                  </TabsContent>
                ) : null}
              </Tabs>
            </div>
            <DialogFooter>
              <Button
                className="w-full sm:w-fit"
                onClick={handleSendInvite}
                disabled={
                  (!emails.trim() && emailBadges.length === 0) ||
                  inviteUser.isPending
                }
              >
                {inviteUser.isPending ? t('Sending...') : t('Send')}
              </Button>
            </DialogFooter>
          </ErrorBoundary>
        </DialogContent>
      </Dialog>

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
            ? user.currentProfile?.name || 'Common'
            : 'Common'
        }
      />
    </>
  );
};
