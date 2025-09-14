'use client';

import { formatToUrl } from '@/utils';
import { useUser } from '@/utils/UserProvider';
import { checkModuleEnabled } from '@/utils/modules';
import { trpc } from '@op/api/client';
import type { Organization } from '@op/api/encoders';
import { Button } from '@op/ui/Button';
import { Header3 } from '@op/ui/Header';
import { Skeleton } from '@op/ui/Skeleton';
import { Tab, TabList, TabPanel } from '@op/ui/Tabs';
import { Tag, TagGroup } from '@op/ui/TagGroup';
import { toast } from '@op/ui/Toast';
import { cn } from '@op/ui/utils';
import { ReactNode, Suspense } from 'react';
import { LuCopy, LuGlobe, LuMail } from 'react-icons/lu';

import { Link, useTranslations } from '@/lib/i18n';

import { ContactLink } from '@/components/ContactLink';
import ErrorBoundary from '@/components/ErrorBoundary';
import { PostFeedSkeleton } from '@/components/PostFeed';
import { PostUpdate } from '@/components/PostUpdate';

import { ProfileFeed } from '../ProfileFeed';
import {
  DecisionsTab,
  DecisionsTabPanel,
  MembersTab,
  MembersTabPanel,
} from './DecisionsTabs';
import { FollowersTab, FollowersTabPanel } from './IndividualTabs';
import { ProfileTabsWithQuery } from './ProfileTabsWithQuery';

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
  const t = useTranslations();

  return (
    <section className="flex flex-col gap-2 text-neutral-charcoal">
      <Header3>{t('Focus Areas')}</Header3>
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
  const t = useTranslations();

  const communitiesServed = terms['candid:POPULATION'];

  if (!communitiesServed?.length) return null;

  return (
    <section className="flex flex-col gap-2 text-neutral-charcoal">
      <Header3>{t('Communities We Serve')}</Header3>
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
  const t = useTranslations();

  return (
    <div className={cn('flex flex-col gap-8', className)}>
      {email || website ? (
        <section className="flex flex-col gap-2">
          <Header3>{t('Contact')}</Header3>
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
                        message: t(
                          'This email address has been copied to your clipboard.',
                        ),
                        dismissable: false,
                      });
                    }}
                  >
                    <LuCopy /> {t('Copy')}
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
          <Header3>{t('Organizational Status')}</Header3>
          <TagGroup>
            <Tag className="capitalize">{orgType}</Tag>
          </TagGroup>
        </section>
      ) : null}

      {mission ? (
        <section className="flex flex-col gap-2 text-neutral-charcoal">
          <Header3>{t('Mission Statement')}</Header3>
          <p>{mission}</p>
        </section>
      ) : null}

      {strategies?.length > 0 ? (
        <section className="flex flex-col gap-2 text-neutral-charcoal">
          <Header3>{t('Strategies')}</Header3>
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
              <Header3>{t('Focus Areas')}</Header3>
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
              <Header3>{t('Communities We Serve')}</Header3>
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
    <div className="hidden h-full flex-grow grid-cols-15 sm:grid">
      {children}
    </div>
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
  const { user } = useUser();
  const isOrg = user?.currentProfile?.type === 'org';

  return (
    <ProfileGridWrapper>
      <div className="col-span-9 flex flex-col gap-8">
        {isOrg ? (
          <Suspense fallback={null}>
            <PostUpdate
              organization={profile}
              label={t('Post')}
              className="border-b px-4 pb-8 pt-6"
            />
          </Suspense>
        ) : (
          <div></div>
        )}
        <Suspense fallback={<PostFeedSkeleton className="px-4" numPosts={3} />}>
          <ProfileFeed profile={profile} />
        </Suspense>
      </div>
      <div className="col-span-6 h-full border-l px-4 py-6">
        <ProfileAbout profile={profile} />
      </div>
    </ProfileGridWrapper>
  );
};

export const ProfileTabList = ({ children }: { children: React.ReactNode }) => (
  <TabList className="flex-shrink-0 px-4 sm:px-6">{children}</TabList>
);

export const ProfileTabs = ({
  children,
  initialTab,
  profileType = 'org',
}: {
  children: React.ReactNode;
  initialTab?: string;
  profileType?: 'org' | 'individual';
}) => {
  // Determine valid tabs and default tab based on profile type
  const validTabs = [
    'home',
    'relationships',
    'about',
    'organizations',
    'following',
    'followers',
    'decisions',
    'members',
  ];
  const defaultTab = profileType === 'individual' ? 'about' : 'home';

  return (
    <ProfileTabsWithQuery
      className="hidden flex-grow gap-0 px-0 sm:flex sm:h-full sm:flex-col"
      initialTab={initialTab}
      defaultTab={defaultTab}
      validTabs={validTabs}
    >
      {children}
    </ProfileTabsWithQuery>
  );
};

export const ProfileTabsMobile = ({
  profile,
  children,
  decisionsContent,
  followingContent,
  followersContent,
  initialTab,
}: {
  profile: Organization; // TODO: THIS IS AN ORG RECORD, NOT A PROFILE. LEGACYNAMING THAT SHOULD BE FIXED
  children?: React.ReactNode;
  decisionsContent?: React.ReactNode;
  followingContent?: React.ReactNode;
  followersContent?: React.ReactNode;
  initialTab?: string;
}) => {
  const t = useTranslations();
  const isIndividual = profile.orgType === null || profile.orgType === '';
  const decisionsEnabled = checkModuleEnabled(
    profile.profile.modules,
    'decisions',
  );

  // Determine valid tabs and default tab based on profile type
  const validTabs = [
    'updates',
    'about',
    'organizations',
    'following',
    'followers',
    'decisions',
    'members',
  ];
  const defaultTab = isIndividual ? 'about' : 'updates';

  return (
    <ProfileTabsWithQuery
      className="px-0 pb-8 sm:hidden"
      initialTab={initialTab}
      defaultTab={defaultTab}
      validTabs={validTabs}
    >
      <TabList className="overflow-x-auto px-4">
        {!isIndividual && <Tab id="updates">{t('Updates')}</Tab>}
        <Tab id="about">{t('About')}</Tab>
        {!isIndividual ? (
          <>
            <FollowersTab />
            {decisionsEnabled && (
              <>
                <MembersTab profileId={profile.id} />
                <DecisionsTab profileId={profile.profile.id} />
              </>
            )}
          </>
        ) : (
          <>
            <Tab id="organizations">{t('Organizations')}</Tab>
            <Tab id="following">{t('Following')}</Tab>
          </>
        )}
      </TabList>
      {!isIndividual && (
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
      )}
      <TabPanel id="about">
        <ProfileAbout profile={profile} className="px-4 py-2" />
      </TabPanel>
      {isIndividual && (
        <>
          <TabPanel id="organizations" className="px-4 py-2">
            <div className="flex flex-col gap-4">{children}</div>
          </TabPanel>
          <TabPanel id="following" className="px-4 py-2">
            {followingContent}
          </TabPanel>
        </>
      )}
      {!isIndividual && (
        <>
          <FollowersTabPanel>{followersContent}</FollowersTabPanel>
          {decisionsEnabled && <MembersTabPanel profileId={profile.id} />}
        </>
      )}
      {decisionsEnabled && (
        <DecisionsTabPanel>{decisionsContent}</DecisionsTabPanel>
      )}
    </ProfileTabsWithQuery>
  );
};
