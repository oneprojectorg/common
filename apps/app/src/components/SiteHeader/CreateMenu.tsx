'use client';

import { useFeatureFlag } from '@/hooks/useFeatureFlag';
import { useLazyOverlay } from '@/hooks/useLazyOverlay';
import { useRequiredUser } from '@/utils/UserProvider';
import { trpc } from '@op/api/client';
import { EntityType } from '@op/api/encoders';
import { useMediaQuery } from '@op/hooks';
import { Button } from '@op/sense/Button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@op/sense/DropdownMenu';
import { Spinner } from '@op/sense/Spinner';
import { toast } from '@op/sense/Toast';
import { screens } from '@op/styles/constants';
import { useMutation } from '@tanstack/react-query';
import dynamic from 'next/dynamic';
import { useState } from 'react';
import { LuMessageCircle, LuPlus, LuUserPlus, LuUsers } from 'react-icons/lu';

import { useRouter, useTranslations } from '@/lib/i18n';

// Both modals are forms nobody sees until they pick an item out of this menu,
// so they load on first open instead of riding along in the header's
// first-paint bundle.
const InviteUserModal = dynamic(
  () => import('../InviteUserModal').then((module) => module.InviteUserModal),
  { ssr: false },
);

const CreateOrganizationModal = dynamic(
  () =>
    import('../Profile/ProfileDetails/CreateOrganizationModal').then(
      (module) => module.CreateOrganizationModal,
    ),
  { ssr: false },
);

// Tailwind v4 default sm breakpoint (640px)
const SM_BREAKPOINT = screens.sm;

export const CreateMenu = () => {
  const t = useTranslations();
  const router = useRouter();
  const inviteModal = useLazyOverlay();
  const createOrganizationModal = useLazyOverlay();
  const { user } = useRequiredUser();
  const isOrg = user.currentProfile?.type === EntityType.ORG;
  const isMobile = useMediaQuery(`(max-width: ${SM_BREAKPOINT})`);
  const createDecisionEnabled = useFeatureFlag('create_decision_process');
  const utils = trpc.useUtils();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const createDecisionMutation = useMutation({
    mutationFn: async () => {
      const { processes: templates } =
        await utils.decision.listProcesses.ensureData({});
      const firstTemplate = templates[0];
      if (!firstTemplate) {
        throw new Error('No decision process templates available');
      }
      return utils.client.decision.createInstanceFromTemplate.mutate({
        templateId: firstTemplate.id,
        name: `New ${firstTemplate.name}`,
      });
    },
    onSuccess: (decisionProfile) => {
      router.push(`/decisions/${decisionProfile.slug}/edit`);
    },
    onError: () => {
      toast.error(t('Failed to create decision'));
    },
  });
  const isCreatingDecision =
    createDecisionMutation.isPending || createDecisionMutation.isSuccess;

  return (
    <>
      <DropdownMenu
        open={isMenuOpen || isCreatingDecision}
        onOpenChange={setIsMenuOpen}
      >
        <DropdownMenuTrigger
          render={
            <Button variant="default" size={isMobile ? 'icon' : 'default'} />
          }
        >
          <LuPlus className="size-4" />
          <span className="hidden sm:block">{t('Create')}</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem
            onClick={() => createOrganizationModal.setIsOpen(true)}
          >
            <LuUsers className="size-4" /> {t('Organization')}
          </DropdownMenuItem>
          {createDecisionEnabled && (
            <DropdownMenuItem
              disabled={isCreatingDecision}
              onClick={() => createDecisionMutation.mutate()}
            >
              {isCreatingDecision ? (
                <Spinner className="size-4" />
              ) : (
                <LuMessageCircle className="size-4" />
              )}{' '}
              {t('Decision-making process')}
            </DropdownMenuItem>
          )}
          {isOrg && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => inviteModal.setIsOpen(true)}>
                <LuUserPlus className="size-4" /> {t('Invite member')}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {createOrganizationModal.shouldRender ? (
        <CreateOrganizationModal
          isOpen={createOrganizationModal.isOpen}
          onOpenChange={createOrganizationModal.setIsOpen}
        />
      ) : null}
      {isOrg && inviteModal.shouldRender ? (
        <InviteUserModal
          isOpen={inviteModal.isOpen}
          onOpenChange={inviteModal.setIsOpen}
        />
      ) : null}
    </>
  );
};
