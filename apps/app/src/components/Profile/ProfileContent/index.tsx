'use client';

import { useRequiredUser } from '@/utils/UserProvider';
import { trpc } from '@op/api/client';
import { type Organization, ProcessStatus } from '@op/api/encoders';
import { formatToUrl } from '@op/common/validation';
import { Button } from '@op/sense/Button';
import { Header2, Header3 } from '@op/sense/Header';
import { Skeleton } from '@op/sense/Skeleton';
import { TabsContent, TabsList, TabsTrigger } from '@op/sense/Tabs';
import { Tag, TagGroup } from '@op/sense/TagGroup';
import { toast } from '@op/sense/Toast';
import { cn } from '@op/sense/lib/utils';
import { Fragment, ReactNode, Suspense } from 'react';
import { LuCopy, LuGlobe, LuMail } from 'react-icons/lu';

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
        {t('Focus Areas')}
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
        {t('Communities We Serve')}
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
      {orgType ? (
        <Header2 className="text-label leading-normal">{t('About')}</Header2>
      ) : null}
      <div className="flex flex-col gap-10 rounded border p-4 sm:rounded-none sm:border-none sm:p-0">
        {email || website ? (
          <section className="flex flex-col gap-2">
            <Header3 className="font-sans text-base font-strong">
              {t('Contact')}
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
                <ContactLink
                  button={
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(email);
                        toast.success(
                          t(
                            'This email address has been copied to your clipboard.',
                          ),
                          { dismissible: false },
                        );
                      }}
                    >
                      <LuCopy /> {t('Copy')}
                    </Button>
                  }
                >
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
              {t('Organizational Status')}
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
              {t('Mission Statement')}
            </Header3>
            <p>{mission}</p>
          </section>
        ) : null}

        {strategies?.length > 0 ? (
          <section className="flex flex-col gap-2">
            <Header3 className="font-sans text-base font-strong">
              {t('Strategies')}
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
                  {t('Focus Areas')}
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
                  {t('Communities We Serve')}
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

const ProfileDecisions = ({ profileId }: { profileId: string }) => {
  const t = useTranslations();

  const [data] = trpc.decision.listDecisionProfiles.useSuspenseQuery({
    limit: 3,
    stewardProfileId: profileId,
    status: [ProcessStatus.PUBLISHED],
  });

  if (!data.items[0]) {
    return null;
  }

  return (
    <div className="flex flex-col gap-2 py-6 pb-2 sm:gap-0 sm:border-b sm:pt-4">
      <Header2 className="text-label leading-normal sm:px-6">
        {t('Decisions')}
      </Header2>
      {data.items.map((item, index) => (
        <Fragment key={item.id}>
          <ProfileDecisionListItem
            item={item}
            className="rounded border p-4 transition-colors sm:rounded-none sm:border-none sm:p-6 hover:sm:bg-accent"
          />
          {index < data.items.length - 1 && <hr className="hidden sm:block" />}
        </Fragment>
      ))}
    </div>
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
    <ProfileGridWrapper>
      <div className="col-span-9 flex flex-col">
        {isOrg ? (
          <Suspense fallback={null}>
            <PostUpdate
              organization={profile}
              label={t('Post')}
              className="rounded-none border-x-0 border-t-0 border-b px-4 pt-6 pb-8"
            />
          </Suspense>
        ) : (
          <div></div>
        )}
        <Suspense fallback={<PostFeedSkeleton className="px-4" numPosts={3} />}>
          <ProfileFeedProvider profile={profile}>
            {(props) => <ProfileFeedList {...props} />}
          </ProfileFeedProvider>
        </Suspense>
      </div>
      <div className="col-span-6 h-full border-s">
        <Suspense fallback={null}>
          <ProfileDecisions profileId={profile.profile.id} />
        </Suspense>
        <div className="flex flex-col gap-4 px-6 py-4">
          <ProfileAbout profile={profile} />
        </div>
      </div>
    </ProfileGridWrapper>
  );
};

export const ProfileTabList = ({ children }: { children: React.ReactNode }) => (
  <TabsList variant="line" className="shrink-0 px-4 sm:px-6">
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
              <TabsTrigger value="updates">{t('Updates')}</TabsTrigger>
              <FollowersTab />
              <MembersTab profileId={profile.profile.id} />
              <DecisionsTab profileId={profile.profile.id} />
            </>
          ) : (
            <>
              <TabsTrigger value="about">{t('About')}</TabsTrigger>
              <TabsTrigger value="organizations">
                {t('Organizations')}
              </TabsTrigger>
              <TabsTrigger value="following">{t('Following')}</TabsTrigger>
            </>
          )}
        </TabsList>
      </div>
      {!isIndividual && (
        <>
          <TabsContent value="home" className="flex flex-col gap-6 px-4">
            <Suspense fallback={null}>
              <ProfileDecisions profileId={profile.profile.id} />
            </Suspense>
            <hr />
            <ProfileAbout profile={profile} />
            <hr />
            <Suspense fallback={<Skeleton className="min-h-20 w-full" />}>
              <div className="-mx-4">
                <Header2 className="px-4 py-2 text-label leading-normal">
                  {t('Posts')}
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
