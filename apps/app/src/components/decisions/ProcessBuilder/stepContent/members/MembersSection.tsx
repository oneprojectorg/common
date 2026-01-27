import { ProfileUsersAccess } from '@/components/decisions/ProfileUsersAccess';

import type { SectionProps } from '../../contentRegistry';

export default function MembersSection({ decisionId }: SectionProps) {
  return (
    <div className="px-24 py-16">
      <div className="mx-auto max-w-5xl">
        <ProfileUsersAccess profileId={decisionId} />
      </div>
    </div>
  );
}
