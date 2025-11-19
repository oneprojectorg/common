'use client';

import { useUser } from '@/utils/UserProvider';
import { Button } from '@op/ui/Button';
import { Menu, MenuItem, MenuSeparator, MenuTrigger } from '@op/ui/Menu';
import { Popover } from '@op/ui/Popover';
import { useState } from 'react';
import { LuMessageCircle, LuPlus, LuUserPlus, LuUsers } from 'react-icons/lu';

import { InviteUserModal } from '../InviteUserModal';

export const CreateMenu = () => {
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const { user } = useUser();
  const isOrg = user?.currentOrganization;
  return (
    <>
      <MenuTrigger>
        <Button className="h-8 rounded-sm px-2 sm:px-3">
          <LuPlus className="size-4" />
          <span className="hidden sm:block">Create</span>
        </Button>
        <Popover>
          <Menu>
            <MenuItem id="create-org" href="/org/new">
              <LuUsers className="size-4" /> Organization
            </MenuItem>
            <MenuItem id="create-decision" href="/processes/new">
              <LuMessageCircle className="size-4" /> Decision-making process
            </MenuItem>
            {isOrg ? (
              <>
                <MenuSeparator />
                <MenuItem
                  id="invite-member"
                  onAction={() => setIsInviteOpen(true)}
                >
                  <LuUserPlus className="size-4" /> Invite member
                </MenuItem>
              </>
            ) : null}
          </Menu>
        </Popover>
      </MenuTrigger>
      {isOrg ? (
        <InviteUserModal
          isOpen={isInviteOpen}
          onOpenChange={setIsInviteOpen}
          useExternalTrigger
        />
      ) : null}
    </>
  );
};
