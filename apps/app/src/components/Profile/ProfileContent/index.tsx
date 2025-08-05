'use client';

import { formatToUrl } from '@/utils';
import { trpc } from '@op/api/client';
import type { Organization } from '@op/api/encoders';
import { Button } from '@op/ui/Button';
import { Header3 } from '@op/ui/Header';
import { Skeleton } from '@op/ui/Skeleton';
import { Tab, TabList, TabPanel, Tabs } from '@op/ui/Tabs';
import { Tag, TagGroup } from '@op/ui/TagGroup';
import { toast } from '@op/ui/Toast';
import { cn } from '@op/ui/utils';
import Link from 'next/link';
import { ReactNode, Suspense } from 'react';
import { LuCopy, LuGlobe, LuMail } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { ContactLink } from '@/components/ContactLink';
import ErrorBoundary from '@/components/ErrorBoundary';
import { PostFeedSkeleton } from '@/components/PostFeed';
import { PostUpdate } from '@/components/PostUpdate';

import { ProfileFeed } from '../ProfileFeed';

const FocusAreas = ({
  focusAreas,
}: {
  focusAreas: Array<{
    id: string;
    label: string;
    termUri: string;
    taxonomyUri: string;
    facet?: string | null;
  }>;
}) => {
  return (
    <section className="flex flex-col gap-2 text-neutral-charcoal">
      <Header3>Focus Areas</Header3>
      <TagGroup>
        {focusAreas.map((term) => (
          <Tag key={term.label}>{term.label}</Tag>
        ))}
      </TagGroup>
    </section>
  );
};

const IndividualFocusAreas = ({ profileId }: { profileId: string }) => {
  const [terms] = trpc.individual.getTermsByProfile.useSuspenseQuery({
    profileId,
  });

  const focusAreas = terms['necSimple:focusArea'];

  if (!focusAreas?.length) return null;

  return <FocusAreas focusAreas={focusAreas} />;
};

const OrganizationFocusAreas = ({ profileId }: { profileId: string }) => {
  const [terms] = trpc.organization.getTerms.useSuspenseQuery({
    id: profileId,
  });

  const focusAreas = terms['necSimple:focusArea'];

  if (!focusAreas?.length) return null;

  return <FocusAreas focusAreas={focusAreas} />;
};

const CommunitiesServed = ({ profileId }: { profileId: string }) => {
  const [terms] = trpc.organization.getTerms.useSuspenseQuery({
    id: profileId,
  });

  const communitiesServed = terms['candid:POPULATION'];

  if (!communitiesServed?.length) return null;

  return (
    <section className="flex flex-col gap-2 text-neutral-charcoal">
      <Header3>Communities We Serve</Header3>
      <TagGroup>
        {communitiesServed.map((term) => (
          <Tag key={term.label}>{term.label}</Tag>
        ))}
      </TagGroup>
    </section>
  );
};

const ProfileAbout = ({
  profile,
  className,
}: {
  profile: Organization;
  className?: string;
}) => {
  const { mission, email, website } = profile.profile;
  const { orgType, strategies } = profile;

  return (
    <div className={cn('flex flex-col gap-8', className)}>
      {email || website ? (
        <section className="flex flex-col gap-2">
          <Header3>Contact</Header3>
          <div className="flex flex-col text-teal">
            {website ? (
              <ContactLink>
                <LuGlobe />
                <Link
                  href={formatToUrl(website)}
                  target="_blank"
                  className="max-w-full overflow-hidden overflow-ellipsis text-nowrap"
                >
                  {website}
                </Link>
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
                      toast.success({
                        message:
                          'This email address has been copied to your clipboard.',
                        dismissable: false,
                      });
                    }}
                  >
                    <LuCopy /> Copy
                  </Button>
                }
              >
                <LuMail className="min-w-4" />
                <Link
                  href={`mailto:${email}`}
                  className="max-w-full overflow-hidden overflow-ellipsis text-nowrap"
                >
                  {email}
                </Link>
              </ContactLink>
            ) : null}
          </div>
        </section>
      ) : null}

      {orgType ? (
        <section className="flex flex-col gap-2 text-neutral-charcoal">
          <Header3>Organizational Status</Header3>
          <TagGroup>
            <Tag className="capitalize">{orgType}</Tag>
          </TagGroup>
        </section>
      ) : null}

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
                  {/* @ts-ignore - odd TS bug that only shows in CI */}
                  {strategy.label}
                </Tag>
              ) : null,
            )}
          </TagGroup>
        </section>
      ) : null}

      <ErrorBoundary fallback={null}>
        <Suspense
          fallback={
            <section className="flex flex-col gap-2 text-neutral-charcoal">
              <Header3>Focus Areas</Header3>
              <div className="flex flex-wrap gap-2">
                <Skeleton className="h-6 w-16" />
                <Skeleton className="h-6 w-20" />
                <Skeleton className="h-6 w-14" />
              </div>
            </section>
          }
        >
          {orgType ? (
            <OrganizationFocusAreas profileId={profile.id} />
          ) : (
            <IndividualFocusAreas profileId={profile.id} />
          )}
        </Suspense>
      </ErrorBoundary>

      <ErrorBoundary fallback={null}>
        <Suspense
          fallback={
            <section className="flex flex-col gap-2 text-neutral-charcoal">
              <Header3>Communities We Serve</Header3>
              <div className="flex flex-wrap gap-2">
                <Skeleton className="h-6 w-18" />
                <Skeleton className="h-6 w-24" />
                <Skeleton className="h-6 w-16" />
              </div>
            </section>
          }
        >
          <CommunitiesServed profileId={profile.id} />
        </Suspense>
      </ErrorBoundary>
    </div>
  );
};

export const ProfileGridWrapper = ({ children }: { children: ReactNode }) => {
  return (
    <div className="hidden flex-grow grid-cols-15 sm:grid">{children}</div>
  );
};

export const ProfileGrid = ({ profile }: { profile: Organization }) => {
  return (
    <ProfileGridWrapper>
      <div className="col-span-6 p-6">
        <ProfileAbout profile={profile} />
      </div>
    </ProfileGridWrapper>
  );
};

export const OrganizationProfileGrid = ({
  profile,
}: {
  profile: Organization;
}) => {
  const t = useTranslations();

  return (
    <ProfileGridWrapper>
      <div className="col-span-9 flex flex-col gap-8">
        <Suspense fallback={null}>
          <PostUpdate
            organization={profile}
            label={t('Post')}
            className="border-b px-4 pb-8 pt-6"
          />
        </Suspense>
        <Suspense fallback={<PostFeedSkeleton className="px-4" numPosts={3} />}>
          <ProfileFeed profile={profile} />
        </Suspense>
      </div>
      <div className="col-span-6 border-l px-4 py-6">
        <ProfileAbout profile={profile} />
      </div>
    </ProfileGridWrapper>
  );
};

export const ProfileTabList = ({ children }: { children: React.ReactNode }) => (
  <TabList className="px-4 sm:px-6">{children}</TabList>
);

export const ProfileTabs = ({ children }: { children: React.ReactNode }) => {
  return <Tabs className="hidden gap-0 px-0 pb-8 sm:flex">{children}</Tabs>;
};

export const ProfileTabsMobile = ({ 
  profile,
  children,
  decisionsContent 
}: { 
  profile: Organization;
  children?: React.ReactNode;
  decisionsContent?: React.ReactNode;
}) => {
  const t = useTranslations();

  return (
    <Tabs className="px-0 pb-8 sm:hidden">
      <TabList className="overflow-x-auto px-4">
        <Tab id="updates">{t('Updates')}</Tab>
        <Tab id="about">{t('About')}</Tab>
        <Tab id="relationships">{t('Relationships')}</Tab>
        <Tab id="followers">{t('Followers')}</Tab>
        <Tab id="members">{t('Members')}</Tab>
        <Tab id="decisions">{t('Decisions')}</Tab>
      </TabList>
      <TabPanel id="updates" className="px-0">
        <Suspense fallback={<Skeleton className="w-full" />}>
          <PostUpdate
            organization={profile}
            label={t('Post')}
            className="border-b px-4 py-6"
          />
        </Suspense>
        <Suspense fallback={<Skeleton className="min-h-20 w-full" />}>
          <ProfileFeed profile={profile} className="px-4 py-2 sm:py-6" />
        </Suspense>
      </TabPanel>
      <TabPanel id="about">
        <ProfileAbout profile={profile} className="px-4 py-2" />
      </TabPanel>
      <TabPanel id="relationships" className="px-4 py-2">
        {children}
      </TabPanel>
      <TabPanel id="followers" className="px-4 py-2">
        <div className="text-center text-neutral-gray4">Followers content coming soon</div>
      </TabPanel>
      <TabPanel id="members" className="px-4 py-2">
        <div className="text-center text-neutral-gray4">Members content coming soon</div>
      </TabPanel>
      <TabPanel id="decisions" className="px-0">
        {decisionsContent}
      </TabPanel>
    </Tabs>
  );
};
