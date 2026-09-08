'use client';

import { useFeatureFlag } from '@/hooks/useFeatureFlag';
import { useRequiredUser } from '@/utils/UserProvider';
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
import { screens } from '@op/styles/constants';
import { useState } from 'react';
import { LuMessageCircle, LuPlus, LuUserPlus, LuUsers } from 'react-icons/lu';

import { useRouter, useTranslations } from '@/lib/i18n';

import { InviteUserModal } from '../InviteUserModal';
import { CreateOrganizationModal } from '../Profile/ProfileDetails/CreateOrganizationModal';

// Tailwind v4 default sm breakpoint (640px)
const SM_BREAKPOINT = screens.sm;

export const CreateMenu = () => {
  const t = useTranslations();
  const router = useRouter();
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isCreateOrganizationModalOpen, setIsCreateOrganizationModalOpen] =
    useState(false);
  const { user } = useRequiredUser();
  const isOrg = user.currentProfile?.type === EntityType.ORG;
  const isMobile = useMediaQuery(`(max-width: ${SM_BREAKPOINT})`);
  const createDecisionEnabled = useFeatureFlag('create_decision_process');
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <>
      <DropdownMenu open={isMenuOpen} onOpenChange={setIsMenuOpen}>
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
            onClick={() => setIsCreateOrganizationModalOpen(true)}
          >
            <LuUsers className="size-4" /> {t('Organization')}
          </DropdownMenuItem>
          {createDecisionEnabled && (
            // The intro wizard collects the shape of the process before
            // anything is created — see CreateProcessWizard.
            <DropdownMenuItem onClick={() => router.push('/decisions/new')}>
              <LuMessageCircle className="size-4" />{' '}
              {t('Decision-making process')}
            </DropdownMenuItem>
          )}
          {isOrg && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setIsInviteModalOpen(true)}>
                <LuUserPlus className="size-4" /> {t('Invite member')}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <CreateOrganizationModal
        isOpen={isCreateOrganizationModalOpen}
        onOpenChange={setIsCreateOrganizationModalOpen}
      />
      {isOrg && (
        <InviteUserModal
          isOpen={isInviteModalOpen}
          onOpenChange={setIsInviteModalOpen}
        />
      )}
    </>
  );
};
