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
} from '@op/sense/Dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@op/sense/Tabs';
import { toast } from '@op/sense/Toast';
import { useFeatureFlagEnabled } from 'posthog-js/react';
import { Suspense, useEffect, useState } from 'react';

import { useTranslations } from '@/lib/i18n';

import ErrorBoundary from '../ErrorBoundary';
import { InviteSuccessModal } from '../InviteSuccessModal';
import { InviteNewOrganization } from './InviteNewOrganization';
import { InviteToExistingOrganization } from './InviteToExistingOrganization';
import { parseEmails } from './emailUtils';

/**
 * Invite people to the current organization. Purely controlled — the opener
 * lives with the caller (today the header's Create menu, which also decides
 * whether the viewer has an organization to invite to at all).
 */
export const InviteUserModal = ({
  isOpen: isModalOpen,
  onOpenChange: setIsModalOpen,
}: {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}) => {
  const [emails, setEmails] = useState('');
  const [emailBadges, setEmailBadges] = useState<string[]>([]);
  const [selectedRole, setSelectedRole] = useState('');
  const [selectedRoleId, setSelectedRoleId] = useState('');
  const [selectedOrganization, setSelectedOrganization] = useState('');
  const [personalMessage, setPersonalMessage] = useState('');
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [lastInvitedEmail, setLastInvitedEmail] = useState('');
  const [invitedCount, setInvitedCount] = useState(0);
  const [activeTab, setActiveTab] = useState('existing');
  const t = useTranslations();
  const { user } = useRequiredUser();
  const isOnline = useConnectionStatus();

  const inviteUserEnabled =
    useFeatureFlagEnabled('invite_admin_user') ||
    user.currentOrganization?.networkOrganization;

  // Follow the profile switcher. This modal stays mounted across a switch, so
  // only initialising when empty left the previous org's id in state — the
  // select then showed a raw uuid (no matching item) and, worse, the invite was
  // sent to the org the user had just left.
  useEffect(() => {
    setSelectedOrganization(user.currentOrganization?.id ?? '');
  }, [user.currentOrganization?.id]);

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

  return (
    <>
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
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
                <div className="mb-2 w-full border-b">
                  <TabsList variant="line" aria-label={t('Invite options')}>
                    <TabsTrigger value="existing">
                      {t('Add to my organization')}
                    </TabsTrigger>
                    {inviteUserEnabled ? (
                      <TabsTrigger value="new">
                        {t('Invite a new organization')}
                      </TabsTrigger>
                    ) : null}
                  </TabsList>
                </div>

                <TabsContent value="existing">
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
                  <TabsContent value="new">
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
