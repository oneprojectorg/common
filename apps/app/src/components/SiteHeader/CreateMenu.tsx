'use client';

import { useUser } from '@/utils/UserProvider';
import { EntityType } from '@op/api/encoders';
import { useMediaQuery } from '@op/hooks';
import { screens } from '@op/styles/constants';
import { Button } from '@op/ui/Button';
import { Menu, MenuItem, MenuSeparator, MenuTrigger } from '@op/ui/Menu';
import { Popover } from '@op/ui/Popover';
import { useState } from 'react';
import { LuMessageCircle, LuPlus, LuUserPlus, LuUsers } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { InviteUserModal } from '../InviteUserModal';
import { CreateDecisionProcessModal } from '../Profile/CreateDecisionProcessModal';
import { CreateOrganizationModal } from '../Profile/ProfileDetails/CreateOrganizationModal';

// Tailwind v4 default sm breakpoint (640px)
const SM_BREAKPOINT = screens.sm;

export const CreateMenu = () => {
  const t = useTranslations();
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isCreateOrganizationModalOpen, setIsCreateOrganizationModalOpen] =
    useState(false);
  const [isCreateProcessModalOpen, setIsCreateProcessModalOpen] =
    useState(false);
  const { user } = useUser();
  const isOrg = user.currentProfile?.type === EntityType.ORG;
  const isMobile = useMediaQuery(`(max-width: ${SM_BREAKPOINT})`);

  return (
    <>
      <MenuTrigger>
        <Button
          className="h-8 rounded-sm px-2 sm:px-3"
          color={isMobile ? 'secondary' : 'primary'}
        >
          <LuPlus className="size-4" />
          <span className="hidden sm:block">{t('Create')}</span>
        </Button>
        <Popover>
          <Menu>
            <MenuItem
              id="create-org"
              onAction={() => setIsCreateOrganizationModalOpen(true)}
            >
              <LuUsers className="size-4" /> {t('Organization')}
            </MenuItem>
            {isOrg ? (
              <>
                <MenuItem
                  id="create-decision"
                  onAction={() => setIsCreateProcessModalOpen(true)}
                >
                  <LuMessageCircle className="size-4" />{' '}
                  {t('Decision-making process')}
                </MenuItem>
                <MenuSeparator />
                <MenuItem
                  id="invite-member"
                  onAction={() => setIsInviteModalOpen(true)}
                >
                  <LuUserPlus className="size-4" /> {t('Invite member')}
                </MenuItem>
              </>
            ) : null}
          </Menu>
        </Popover>
      </MenuTrigger>
      <CreateOrganizationModal
        isOpen={isCreateOrganizationModalOpen}
        onOpenChange={setIsCreateOrganizationModalOpen}
      />
      {isOrg && (
        <>
          <CreateDecisionProcessModal
            isOpen={isCreateProcessModalOpen}
            onOpenChange={setIsCreateProcessModalOpen}
          />
          <InviteUserModal
            isOpen={isInviteModalOpen}
            onOpenChange={setIsInviteModalOpen}
          />
        </>
      )}
    </>
  );
};
