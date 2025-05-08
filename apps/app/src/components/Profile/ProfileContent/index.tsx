import { UserProvider } from '@/utils/UserProvider';
import type { Organization } from '@op/trpc/encoders';
import { Button } from '@op/ui/Button';
import { Header3 } from '@op/ui/Header';
import { Tab, TabList, TabPanel, Tabs } from '@op/ui/Tabs';
import { Tag, TagGroup } from '@op/ui/TagGroup';
import Link from 'next/link';
import { Suspense } from 'react';
import { LuCopy, LuGlobe, LuMail } from 'react-icons/lu';
import { toast } from 'sonner';

import { PostUpdate } from '@/components/PostUpdate';

import { ProfileFeed } from '../ProfileFeed';

const ContactLink = ({
  children,
  button,
}: {
  children: React.ReactNode;
  button?: React.ReactNode;
}) => {
  return (
    <div className="flex h-8 items-center gap-2">
      <div className="flex items-center gap-1">{children}</div>
      {button}
    </div>
  );
};

const ProfileAbout = ({ profile }: { profile: Organization }) => {
  const { mission, email, website, orgType, strategies } = profile;

  return (
    <div className="flex flex-col gap-8">
      {email || website ? (
        <section className="flex flex-col gap-2">
          <Header3>Contact</Header3>
          <div className="flex flex-col text-teal">
            {website ? (
              <ContactLink>
                <LuGlobe />
                <Link href={website}>{website}</Link>
              </ContactLink>
            ) : null}
            {email ? (
              <ContactLink
                button={
                  <Button
                    color="secondary"
                    size="small"
                    onPress={() => {
                      navigator.clipboard.writeText(email);
                      toast.success('Copied to clipboard');
                    }}
                  >
                    <LuCopy /> Copy
                  </Button>
                }
              >
                <LuMail className="min-w-4" />
                <Link href={`mailto:${email}`}>{email}</Link>
              </ContactLink>
            ) : null}
          </div>
        </section>
      ) : null}

      <section className="flex flex-col gap-2 text-neutral-charcoal">
        <Header3>Organizational Status</Header3>
        <TagGroup>
          <Tag>{orgType}</Tag>
        </TagGroup>
      </section>

      {mission ? (
        <section className="flex flex-col gap-2 text-neutral-charcoal">
          <Header3>Mission Statement</Header3>
          <p>{mission}</p>
        </section>
      ) : null}

      {strategies?.length > 0 ? (
        <section className="flex flex-col gap-2 text-neutral-charcoal">
          <Header3>Strategies</Header3>
          <TagGroup>
            {strategies.map((strategy) => (
              <Tag>{strategy.label as unknown as string}</Tag>
            ))}
          </TagGroup>
        </section>
      ) : null}
    </div>
  );
};

export const ProfileGrid = ({ profile }: { profile: Organization }) => {
  return (
    <div className="hidden flex-grow grid-cols-15 border-t sm:grid">
      <div className="col-span-9 flex flex-col gap-8">
        <Suspense fallback={null}>
          <UserProvider>
            <PostUpdate className="border-b px-4 pb-8 pt-6" />
          </UserProvider>
        </Suspense>
        <Suspense fallback={<div>Loading...</div>}>
          <ProfileFeed profile={profile} className="px-4" />
        </Suspense>
      </div>
      <div className="col-span-6 border-l px-4 py-6">
        <ProfileAbout profile={profile} />
      </div>
    </div>
  );
};

export const ProfileTabs = ({ profile }: { profile: Organization }) => {
  return (
    <Tabs className="pb-8 sm:hidden">
      <TabList className="px-4">
        <Tab id="updates">Updates</Tab>
        <Tab id="about">About</Tab>
      </TabList>
      <TabPanel id="updates" className="px-6">
        <Suspense fallback={null}>
          <UserProvider>
            <PostUpdate className="border-b px-4 py-6" />
          </UserProvider>
        </Suspense>
        <Suspense fallback={<div>Loading...</div>}>
          <ProfileFeed profile={profile} className="px-4 py-6" />
        </Suspense>
      </TabPanel>
      <TabPanel id="about">
        <ProfileAbout profile={profile} />
      </TabPanel>
    </Tabs>
  );
};
