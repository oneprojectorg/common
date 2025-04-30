import type { Organization } from '@op/trpc/encoders';
import Link from 'next/link';
import { Suspense } from 'react';
import { LuGlobe, LuMail } from 'react-icons/lu';

import { Header3 } from '@/components/Header';

import { ProfileFeed, ProfileFeedPost } from '../ProfileFeed';

const ContactLink = ({ children }: { children: React.ReactNode }) => {
  return <div className="flex items-center gap-1">{children}</div>;
};

const ProfileAbout = ({ profile }: { profile: Organization }) => {
  const { mission, email, website } = profile;

  return (
    <div className="flex flex-col gap-8">
      {email || website ? (
        <section className="flex flex-col gap-6">
          <Header3>Contact</Header3>
          <div className="flex flex-col gap-4 text-teal">
            {website ? (
              <ContactLink>
                <LuGlobe />
                <Link href={website}>{website}</Link>
              </ContactLink>
            ) : null}
            {email ? (
              <ContactLink>
                <LuMail />
                <Link href={`mailto:${email}`}>{email}</Link>
              </ContactLink>
            ) : null}
          </div>
        </section>
      ) : null}
      {mission ? (
        <section className="flex flex-col gap-6">
          <Header3>Mission Statement</Header3>
          <p>{mission}</p>
        </section>
      ) : null}
    </div>
  );
};

export const ProfileTabs = ({ profile }: { profile: Organization }) => {
  return (
    <div className="grid grid-cols-3 border-t">
      <div className="col-span-2 flex flex-col gap-8">
        <ProfileFeedPost profile={profile} className="border-b px-4 py-6" />
        <Suspense fallback={<div>Loading...</div>}>
          <ProfileFeed profile={profile} className="px-4 py-6" />
        </Suspense>
      </div>
      <div className="border-l px-4 py-6">
        <ProfileAbout profile={profile} />
      </div>
    </div>
  );
};
