'use client';

import { trpc } from '@op/api/client';
import { SearchField } from '@op/ui/SearchField';
import { useMemo, useState } from 'react';

import { useTranslations } from '@/lib/i18n';

import { DecisionMembersTable } from './DecisionMembersTable';

export const DecisionMembersPage = ({ profileId }: { profileId: string }) => {
  const t = useTranslations();
  const [searchQuery, setSearchQuery] = useState('');

  const [members] = trpc.profile.listUsers.useSuspenseQuery({
    profileId,
  });

  // Filter members based on search query
  const filteredMembers = useMemo(() => {
    if (!members) {
      return [];
    }
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

  return (
    <div className="flex flex-col gap-4">
      <h2 className="font-serif text-title-sm font-light text-neutral-black">
        {t('Members')}
      </h2>

      <SearchField
        placeholder={t('Search')}
        value={searchQuery}
        onChange={setSearchQuery}
        className="w-[368px]"
      />

      <DecisionMembersTable members={filteredMembers} profileId={profileId} />
    </div>
  );
};
