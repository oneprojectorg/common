'use client';

import { useRequiredUser } from '@/utils/UserProvider';
import { trpc } from '@op/api/client';
import {
  type Organization,
  ProcessStatus,
  type Profile,
} from '@op/api/encoders';
import { formatToUrl } from '@op/common/validation';
import { Card, CardContent } from '@op/sense/Card';
import { Header2, Header3 } from '@op/sense/Header';
import { Skeleton } from '@op/sense/Skeleton';
import { TabsContent, TabsList, TabsTrigger } from '@op/sense/Tabs';
import { Tag, TagGroup } from '@op/sense/TagGroup';
import { cn } from '@op/sense/lib/utils';
import { Fragment, ReactNode, Suspense } from 'react';
import { LuGlobe, LuMail } from 'react-icons/lu';

import { Link, useTranslations } from '@/lib/i18n';

import { ContactLink } from '@/components/ContactLink';
import ErrorBoundary from '@/components/ErrorBoundary';
import { PostFeedSkeleton } from '@/components/PostFeed';
import { PostUpdate } from '@/components/PostUpdate';
import { ProfileDecisionListItem } from '@/components/decisions/DecisionListItem';

import {
  ProfileFeedCards,
  ProfileFeedList,
  ProfileFeedProvider,
} from '../ProfileFeed';
import { CopyEmailButton } from './CopyEmailButton';
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
    <section className="flex flex-col gap-2">
      <Header3 className="font-sans text-base font-strong">
        {t('org.focusAreasLabel')}
      </Header3>
      <TagGroup>
        {focusAreas.map((term) => (
          <Tag key={term.label} variant="secondary">
            {term.label}
          </Tag>
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
    <section className="flex flex-col gap-2">
      <Header3 className="font-sans text-base font-strong">
        {t('profile.communitiesServedHeading')}
      </Header3>
      <TagGroup>
        {communitiesServed.map((term) => (
          <Tag key={term.label} variant="secondary">
            {term.label}
          </Tag>
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
    <div className={cn('flex flex-col gap-2 sm:gap-6', className)}>
      <div className="flex flex-col gap-10 rounded border p-4 sm:rounded-none sm:border-none sm:p-0">
        {email || website ? (
          <section className="flex flex-col gap-2">
            <Header3 className="font-sans text-base font-strong">
              {t('profile.contactHeading')}
            </Header3>
            <div className="flex flex-col gap-2 text-primary">
              {website ? (
                <ContactLink>
                  <LuGlobe />
                  <Link
                    href={formatToUrl(website)}
                    target="_blank"
                    className="max-w-full overflow-hidden text-nowrap overflow-ellipsis"
                  >
                    {website}
                  </Link>
                </ContactLink>
              ) : null}
              {email ? (
                <ContactLink button={<CopyEmailButton email={email} />}>
                  <LuMail className="min-w-4" />
                  <Link
                    href={`mailto:${email}`}
                    className="max-w-full overflow-hidden text-nowrap overflow-ellipsis"
                  >
                    {email}
                  </Link>
                </ContactLink>
              ) : null}
            </div>
          </section>
        ) : null}

        {orgType ? (
          <section className="flex flex-col gap-2">
            <Header3 className="font-sans text-base font-strong">
              {t('org.statusLabel')}
            </Header3>
            <TagGroup>
              <Tag className="capitalize" variant="secondary">
                {orgType}
              </Tag>
            </TagGroup>
          </section>
        ) : null}

        {mission ? (
          <section className="flex flex-col gap-2">
            <Header3 className="font-sans text-base font-strong">
              {t('profile.missionHeading')}
            </Header3>
            <p>{mission}</p>
          </section>
        ) : null}

        {strategies?.length > 0 ? (
          <section className="flex flex-col gap-2">
            <Header3 className="font-sans text-base font-strong">
              {t('profile.strategiesHeading')}
            </Header3>
            <TagGroup>
              {strategies.map((strategy) =>
                strategy ? (
                  <Tag key={strategy.id} variant="secondary">
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
              <section className="flex flex-col gap-2">
                <Header3 className="font-sans text-base font-strong">
                  {t('org.focusAreasLabel')}
                </Header3>
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
              <section className="flex flex-col gap-2">
                <Header3 className="font-sans text-base font-strong">
                  {t('profile.communitiesServedHeading')}
                </Header3>
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
    </div>
  );
};

const ProfileDecisions = ({ profile }: { profile: Profile }) => {
  const t = useTranslations();

  const [{ items: decisionProfiles }] =
    trpc.decision.listDecisionProfiles.useSuspenseQuery({
      limit: 3,
      stewardProfileId: profile.id,
      status: [ProcessStatus.PUBLISHED],
    });

  if (!decisionProfiles[0]) {
    return null;
  }

  return (
    <section className="flex flex-col gap-4">
      <ProfileSectionHeading>
        {t('decisions.decisionsLabel')}
      </ProfileSectionHeading>
      <Card>
        <CardContent className="flex flex-col">
          {decisionProfiles.map((item, index) => (
            <Fragment key={item.id}>
              {index > 0 && <hr className="my-4" />}
              <ProfileDecisionListItem item={item} />
            </Fragment>
          ))}
        </CardContent>
      </Card>
      <Link
        href={`/org/${profile.slug}?tab=decisions`}
        className="text-primary"
      >
        {t('profile.seeAllDecisionsAction')}
      </Link>
    </section>
  );
};

export const ProfileGridWrapper = ({ children }: { children: ReactNode }) => {
  return (
    <div className="hidden h-full grow grid-cols-15 sm:grid">{children}</div>
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
  const { user } = useRequiredUser();
  const isOrg = user.currentProfile?.type === 'org';

  return (
    <div className="hidden w-full gap-6 pb-6 sm:flex sm:flex-col lg:flex-row lg:items-start">
      <section className="flex min-w-0 flex-1 flex-col gap-4">
        <ProfileSectionHeading>
          {t('profile.updatesHeading')}
        </ProfileSectionHeading>
        {isOrg ? (
          <Suspense fallback={null}>
            <PostUpdate
              organization={profile}
              label={t('Post')}
              className="rounded-lg p-4"
            />
          </Suspense>
        ) : null}
        <Suspense fallback={<PostFeedSkeleton className="px-4" numPosts={3} />}>
          <ProfileFeedProvider profile={profile}>
            {(props) => <ProfileFeedList {...props} />}
          </ProfileFeedProvider>
        </Suspense>
      </section>
      <div className="flex flex-col gap-8 lg:w-90 lg:shrink-0 xl:w-104">
        <Suspense fallback={null}>
          <ProfileDecisions profile={profile.profile} />
        </Suspense>
        <section className="flex flex-col gap-4">
          <ProfileSectionHeading>{t('profile.aboutTab')}</ProfileSectionHeading>
          <Card>
            <CardContent>
              <ProfileAbout profile={profile} />
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
};

/** The 992px column the org profile hero, tabs and body share. */
export const ProfileColumn = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) => (
  <div className={cn('mx-auto w-full max-w-260 px-4 sm:px-6', className)}>
    {children}
  </div>
);

export const ProfileTabList = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => (
  <TabsList variant="line" className={cn('shrink-0 px-4 sm:px-6', className)}>
    {children}
  </TabsList>
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
      className="hidden grow gap-0 px-0 sm:flex sm:h-full sm:flex-col"
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

  // Determine valid tabs and default tab based on profile type
  const validTabs = [
    'home',
    'updates',
    'about',
    'organizations',
    'following',
    'followers',
    'decisions',
    'members',
  ];
  const defaultTab = isIndividual ? 'about' : 'home';

  return (
    <ProfileTabsWithQuery
      className="px-0 pb-8 sm:hidden"
      initialTab={initialTab}
      defaultTab={defaultTab}
      validTabs={validTabs}
    >
      <div className="scrollbar-none w-full overflow-x-auto border-b px-4">
        <TabsList variant="line">
          {!isIndividual && <TabsTrigger value="home">{t('Home')}</TabsTrigger>}
          {!isIndividual ? (
            <>
              <TabsTrigger value="updates">{t('posts.updatesTab')}</TabsTrigger>
              <FollowersTab />
              <MembersTab profileId={profile.profile.id} />
              <DecisionsTab profileId={profile.profile.id} />
            </>
          ) : (
            <>
              <TabsTrigger value="about">{t('profile.aboutTab')}</TabsTrigger>
              <TabsTrigger value="organizations">
                {t('Organizations')}
              </TabsTrigger>
              <TabsTrigger value="following">
                {t('profile.followingTab')}
              </TabsTrigger>
            </>
          )}
        </TabsList>
      </div>
      {!isIndividual && (
        <>
          <TabsContent value="home" className="flex flex-col gap-6 px-4">
            <Suspense fallback={null}>
              <ProfileDecisions profile={profile.profile} />
            </Suspense>
            <hr />
            <section className="flex flex-col gap-2">
              <ProfileSectionHeading>
                {t('profile.aboutTab')}
              </ProfileSectionHeading>
              <ProfileAbout profile={profile} />
            </section>
            <hr />
            <Suspense fallback={<Skeleton className="min-h-20 w-full" />}>
              <div className="-mx-4">
                <Header2 className="px-4 py-2 text-label leading-normal">
                  {t('profile.postsTab')}
                </Header2>
                <ProfileFeedProvider profile={profile}>
                  {(props) => <ProfileFeedCards {...props} />}
                </ProfileFeedProvider>
              </div>
            </Suspense>
          </TabsContent>
          <TabsContent value="updates">
            <Suspense fallback={<Skeleton className="w-full" />}>
              <PostUpdate
                organization={profile}
                label={t('Post')}
                className="rounded-none border-x-0 border-t-0 border-b px-4 pt-2 pb-6"
              />
            </Suspense>
            <Suspense fallback={<Skeleton className="min-h-20 w-full" />}>
              <ProfileFeedProvider profile={profile}>
                {(props) => (
                  <ProfileFeedList {...props} className="sm:p-4 sm:py-6" />
                )}
              </ProfileFeedProvider>
            </Suspense>
          </TabsContent>
        </>
      )}

      {isIndividual && (
        <>
          <TabsContent value="about">
            <ProfileAbout profile={profile} className="px-4 py-2" />
          </TabsContent>
          <TabsContent value="organizations" className="px-4 py-2">
            <div className="flex flex-col gap-4">{children}</div>
          </TabsContent>
          <TabsContent value="following" className="px-4 py-2">
            {followingContent}
          </TabsContent>
        </>
      )}
      {!isIndividual && (
        <>
          <FollowersTabPanel>{followersContent}</FollowersTabPanel>
          <MembersTabPanel profileId={profile.profile.id} />
        </>
      )}
      <DecisionsTabPanel>{decisionsContent}</DecisionsTabPanel>
    </ProfileTabsWithQuery>
  );
};

const ProfileSectionHeading = ({ children }: { children: ReactNode }) => (
  <Header2 className="text-title">{children}</Header2>
);
