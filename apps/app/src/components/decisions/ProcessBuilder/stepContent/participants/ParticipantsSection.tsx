import { ProfileUsersAccess } from '@/components/decisions/ProfileUsersAccess';

import type { SectionProps } from '../../contentRegistry';

export default function ParticipantsSection({
  decisionProfileId,
  instanceId,
  decisionName,
}: SectionProps) {
  return (
    <div className="p-4 md:p-8">
      <div className="w-full">
        <ProfileUsersAccess
          profileId={decisionProfileId}
          instanceId={instanceId}
          processName={decisionName}
        />
      </div>
    </div>
  );
}
