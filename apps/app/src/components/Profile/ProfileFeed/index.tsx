import { Header3 } from '@/components/Header';
import { getPublicUrl } from '@/utils';
import Image from 'next/image';

import type { Organization } from '@op/trpc/encoders';

export const ProfileFeed = ({ profile }: { profile: Organization }) => {
  const profileImageUrl = getPublicUrl(profile.avatarImage?.name);

  return (
    <div className="flex flex-col gap-8">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex gap-4">
          <div className="relative w-16">
            <Image
              src={profileImageUrl}
              alt=""
              fill
              className="h-16 max-h-16 w-full max-w-16"
            />
          </div>
          <div className="flex w-full flex-col items-start justify-start gap-3">
            <span className="flex items-baseline gap-2">
              <Header3 className="font-medium leading-5">
                {profile.name}
              </Header3>
              <span className="text-xs text-darkGray">2 hours</span>
            </span>
            <div className="leading-6">
              We're excited to announce our 2025 Community Economics Initiative,
              focusing on three priority areas: cooperative ownership models,
              regional food systems, and community-controlled infrastructure.
              This $5.2M initiative builds on our learnings from pilot programs
              in 12 communities across 4 continents.
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
