import { ProfileUsersAccess } from '@/components/decisions/ProfileUsersAccess';

import type { SectionProps } from '../../contentRegistry';

export default function ParticipantsSection({
  decisionProfileId,
  decisionName,
}: SectionProps) {
  return (
    <div className="px-4 md:px-24 md:py-16">
      <div className="mx-auto max-w-5xl">
        <ProfileUsersAccess
          profileId={decisionProfileId}
          processName={decisionName}
        />
      </div>
    </div>
  );
}
