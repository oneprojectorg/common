'use client';

import { formatToUrl } from '@/utils';
import { trpc } from '@op/api/client';
import type { Organization } from '@op/api/encoders';
import { Button } from '@op/ui/Button';
import { Header3 } from '@op/ui/Header';
import { LoadingSpinner } from '@op/ui/LoadingSpinner';
import { Skeleton } from '@op/ui/Skeleton';
import { Tab, TabList, TabPanel, Tabs } from '@op/ui/Tabs';
import { Tag, TagGroup } from '@op/ui/TagGroup';
import Link from 'next/link';
import { Suspense } from 'react';
import { LuCopy, LuGlobe, LuMail } from 'react-icons/lu';
import { toast } from 'sonner';

import { Link as I18nLink } from '@/lib/i18n';

import { PostFeedSkeleton } from '@/components/PostFeed';
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
  const [terms] = trpc.organization.getTerms.useSuspenseQuery({
    id: profile.id,
  });

  const communitiesServed = terms['candid:POPULATION'];
  const focusAreas = terms['necSimple:focusArea'];

  return (
    <div className="flex flex-col gap-8">
      {email || website ? (
        <section className="flex flex-col gap-2">
          <Header3>Contact</Header3>
          <div className="flex flex-col text-teal">
            {website ? (
              <ContactLink>
                <LuGlobe />
                <Link href={formatToUrl(website)}>{website}</Link>
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
            {strategies.map((strategy) =>
              strategy ? (
                <Tag key={strategy.id}>
                  <I18nLink href={`/org/?terms=${strategy.id}`}>
                    {/* @ts-ignore - odd TS bug that only shows in CI */}
                    {strategy.label}
                  </I18nLink>
                </Tag>
              ) : null,
            )}
          </TagGroup>
        </section>
      ) : null}

      {focusAreas?.length ? (
        <section className="flex flex-col gap-2 text-neutral-charcoal">
          <Header3>Focus Areas</Header3>
          <TagGroup>
            {focusAreas.map((term) => (
              <Tag>{term.label}</Tag>
            ))}
          </TagGroup>
        </section>
      ) : null}
      {communitiesServed?.length ? (
        <section className="flex flex-col gap-2 text-neutral-charcoal">
          <Header3>Communities We Serve</Header3>
          <TagGroup>
            {communitiesServed.map((term) => (
              <Tag>{term.label}</Tag>
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
          <PostUpdate
            organization={profile}
            className="border-b px-4 pb-8 pt-6"
          />
        </Suspense>
        <Suspense fallback={<PostFeedSkeleton className="px-4" numPosts={3} />}>
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
        <Suspense fallback={<Skeleton className="w-full" />}>
          <PostUpdate organization={profile} className="border-b px-4 py-6" />
        </Suspense>
        <Suspense fallback={<Skeleton className="min-h-20 w-full" />}>
          <ProfileFeed profile={profile} className="px-4 py-6" />
        </Suspense>
      </TabPanel>
      <TabPanel id="about">
        <ProfileAbout profile={profile} />
      </TabPanel>
    </Tabs>
  );
};
