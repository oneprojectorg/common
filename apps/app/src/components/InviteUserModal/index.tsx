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
import { isValidEmail, parseEmails } from './emailUtils';
import { useAdminOrganizations } from './useAdminOrganizations';

type InviteTab = 'existing' | 'new';

/**
 * Invite people to Common — either to an organization the viewer administers or
 * as a brand new organization. Purely controlled: the opener lives with the
 * caller (today the header's Create menu, which only renders it while the
 * active profile is an organization).
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
  const [selectedRoleId, setSelectedRoleId] = useState('');
  const [selectedOrganization, setSelectedOrganization] = useState('');
  const [personalMessage, setPersonalMessage] = useState('');
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [lastInvitedEmail, setLastInvitedEmail] = useState('');
  const [invitedCount, setInvitedCount] = useState(0);
  const [activeTab, setActiveTab] = useState<InviteTab>('existing');
  const t = useTranslations();
  const { user } = useRequiredUser();
  const isOnline = useConnectionStatus();
  const organizationItems = useAdminOrganizations();

  const inviteUserEnabled =
    useFeatureFlagEnabled('invite_admin_user') ||
    user.currentOrganization?.networkOrganization;

  // Follow the profile switcher. This modal stays mounted across a switch, so
  // initialising only when empty left the previous org's id in state, and that
  // id is what the invite is sent to.
  useEffect(() => {
    setSelectedOrganization(user.currentOrganization?.id ?? '');
  }, [user.currentOrganization?.id]);

  const collectEmails = () => [...emailBadges, ...parseEmails(emails).emails];

  const inviteUser = trpc.organization.invite.useMutation({
    onSuccess: (result) => {
      // A 200 only means the request was accepted. The server reports per-email
      // outcomes in the payload, and `success` is merely "at least one landed",
      // so an all-failed batch arrives here rather than in onError.
      const failed = result.details?.failed ?? [];

      if (!result.success) {
        logger.error('Invite sent no invitations', {
          context: 'InviteUserModal.sendInvite',
          failed,
        });
        toast.error(t('No invitations were sent'), {
          description: describeFailures(failed),
        });
        return;
      }

      if (failed.length > 0) {
        toast.warning(t('Some invitations could not be sent'), {
          description: describeFailures(failed),
        });
      }

      handleInviteSuccess(result.details?.successful ?? []);
    },
    onError: (error) => {
      handleInviteError(error, t('Failed to send invite'));
    },
  });

  const handleInviteSuccess = (invitedEmails: string[]) => {
    setLastInvitedEmail(invitedEmails[0] ?? '');
    setInvitedCount(invitedEmails.length);

    setEmails('');
    setEmailBadges([]);
    setPersonalMessage('');
    setIsModalOpen(false);
    setIsSuccessModalOpen(true);
  };

  const handleInviteError = (error: unknown, title: string) => {
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

  const sendInvite = (recipients: string[]) => {
    if (!isOnline) {
      toast.error(t('No connection'), {
        description: t('Please check your internet connection and try again.'),
      });
      return;
    }

    inviteUser.mutate(
      activeTab === 'new'
        ? {
            emails: recipients,
            ...(personalMessage ? { personalMessage } : {}),
          }
        : {
            emails: recipients,
            roleId: selectedRoleId,
            organizationId: selectedOrganization,
          },
    );
  };

  const handleSendInvite = () => {
    const allEmails = collectEmails();

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

    sendInvite(allEmails);
  };

  // The existing-organization tab needs a target the server will accept; an
  // empty id fails the input schema and surfaces as a raw validation error.
  const canSend =
    (emails.trim().length > 0 || emailBadges.length > 0) &&
    (activeTab === 'new' || Boolean(selectedOrganization && selectedRoleId));

  return (
    <>
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{t('Invite others to Common')}</DialogTitle>
          </DialogHeader>
          <ErrorBoundary>
            <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-scroll p-6">
              <Tabs
                value={activeTab}
                onValueChange={(value) => {
                  if (value === 'existing' || value === 'new') {
                    setActiveTab(value);
                  }
                }}
              >
                {/* Negative margin + matching padding let the tab strip scroll
                    edge to edge inside the padded dialog; the rule is sticky so
                    it stays full width as the strip scrolls under it. */}
                <div className="-mx-6 mb-2 no-scrollbar min-w-full overflow-x-scroll px-6">
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
                  <hr className="sticky start-0" />
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
                      selectedRoleId={selectedRoleId}
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
                disabled={!canSend || inviteUser.isPending}
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
        // The org actually invited to, which since the select lists every
        // organization the viewer administers is not necessarily the active one.
        organizationName={
          (activeTab === 'existing'
            ? organizationItems.find(
                (item) => item.value === selectedOrganization,
              )?.label
            : undefined) || 'Common'
        }
      />
    </>
  );
};

/** Server-side reasons are already English strings; keep them verbatim. */
const describeFailures = (failed: { email: string; reason: string }[]) =>
  failed.map(({ email, reason }) => `${email}: ${reason}`).join('\n');
