import { ProfileUsersAccessPage } from '@/components/decisions/ProfileUsersAccessPage';

import type { SectionProps } from '../../contentRegistry';

export default function MembersSection({ decisionId }: SectionProps) {
  return (
    <div className="px-24 py-16">
      <div className="mx-auto max-w-5xl">
        <ProfileUsersAccessPage profileId={decisionId} />
      </div>
    </div>
  );
}
