'use client';

import { trpc } from '@op/api/client';
import { Button } from '@op/ui/Button';
import { SearchField } from '@op/ui/SearchField';
import { useMemo, useState } from 'react';
import { LuUserPlus, LuUsers } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { DecisionMembersTable } from './DecisionMembersTable';
import { InviteDecisionMemberModal } from './InviteDecisionMemberModal';

export const DecisionMembersPage = ({ profileId }: { profileId: string }) => {
  const t = useTranslations();
  const [searchQuery, setSearchQuery] = useState('');
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);

  const [members] = trpc.profile.listUsers.useSuspenseQuery({
    profileId,
  });

  // Filter members based on search query
  const filteredMembers = useMemo(() => {
    if (!searchQuery.trim()) {
      return members;
    }

    const query = searchQuery.toLowerCase();
    return members.filter((member) => {
      const name = member.name?.toLowerCase() || '';
      const email = member.email.toLowerCase();
      return name.includes(query) || email.includes(query);
    });
  }, [members, searchQuery]);

  if (!members || members.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <h2 className="font-serif text-title-sm font-light text-neutral-black">
          {t('Members')}
        </h2>

        <div className="flex items-center justify-between">
          <SearchField
            placeholder={t('Search')}
            value={searchQuery}
            onChange={setSearchQuery}
            className="w-[368px]"
          />
          <Button
            color="secondary"
            variant="icon"
            onPress={() => setIsInviteModalOpen(true)}
          >
            <LuUserPlus className="size-4" />
            {t('Invite')}
          </Button>
        </div>

        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-neutral-gray1">
            <LuUsers className="h-6 w-6 text-neutral-gray4" />
          </div>
          <div className="mb-2 font-serif text-title-base text-neutral-black">
            {t('No members found')}
          </div>
          <p className="max-w-md text-sm text-neutral-charcoal">
            {t('Invite members to collaborate on this decision.')}
          </p>
        </div>

        <InviteDecisionMemberModal
          profileId={profileId}
          isOpen={isInviteModalOpen}
          onOpenChange={setIsInviteModalOpen}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 className="font-serif text-title-sm font-light text-neutral-black">
        {t('Members')}
      </h2>

      <div className="flex items-center justify-between">
        <SearchField
          placeholder={t('Search')}
          value={searchQuery}
          onChange={setSearchQuery}
          className="w-[368px]"
        />
        <Button
          color="secondary"
          variant="icon"
          onPress={() => setIsInviteModalOpen(true)}
        >
          <LuUserPlus className="size-4" />
          {t('Invite')}
        </Button>
      </div>

      <DecisionMembersTable members={filteredMembers} profileId={profileId} />

      <InviteDecisionMemberModal
        profileId={profileId}
        isOpen={isInviteModalOpen}
        onOpenChange={setIsInviteModalOpen}
      />
    </div>
  );
};
