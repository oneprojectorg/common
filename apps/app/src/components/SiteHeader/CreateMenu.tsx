'use client';

import { useUser } from '@/utils/UserProvider';
import { EntityType } from '@op/api/encoders';
import { Button } from '@op/ui/Button';
import { Menu, MenuItem, MenuSeparator, MenuTrigger } from '@op/ui/Menu';
import { Popover } from '@op/ui/Popover';
import { useState } from 'react';
import { LuMessageCircle, LuPlus, LuUserPlus, LuUsers } from 'react-icons/lu';

import { InviteUserModal } from '../InviteUserModal';
import { CreateDecisionProcessModal } from '../Profile/CreateDecisionProcessModal';

export const CreateMenu = () => {
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isCreateProcessModalOpen, setIsCreateProcessModalOpen] =
    useState(false);
  const { user } = useUser();
  const isOrg = user?.currentProfile?.type === EntityType.ORG;
  return (
    <>
      <MenuTrigger>
        <Button className="h-8 rounded-sm px-2 sm:px-3">
          <LuPlus className="size-4" />
          <span className="hidden sm:block">Create</span>
        </Button>
        <Popover>
          <Menu>
            <MenuItem id="create-org">
              <LuUsers className="size-4" /> Organization
            </MenuItem>
            {isOrg ? (
              <>
                <MenuItem
                  id="create-decision"
                  onAction={() => setIsCreateProcessModalOpen(true)}
                >
                  <LuMessageCircle className="size-4" /> Decision-making process
                </MenuItem>
                <MenuSeparator />
                <MenuItem
                  id="invite-member"
                  onAction={() => setIsInviteModalOpen(true)}
                >
                  <LuUserPlus className="size-4" /> Invite member
                </MenuItem>
              </>
            ) : null}
          </Menu>
        </Popover>
      </MenuTrigger>
      {isOrg && (
        <CreateDecisionProcessModal
          isOpen={isCreateProcessModalOpen}
          onOpenChange={setIsCreateProcessModalOpen}
        />
      )}
      {isOrg && (
        <InviteUserModal
          isOpen={isInviteModalOpen}
          onOpenChange={setIsInviteModalOpen}
        />
      )}
    </>
  );
};
