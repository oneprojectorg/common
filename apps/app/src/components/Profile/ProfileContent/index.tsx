'use client';

import { useUser } from '@/utils/UserProvider';
import { checkModuleEnabled } from '@/utils/modules';
import { trpc } from '@op/api/client';
import { type Organization, ProcessStatus } from '@op/api/encoders';
import { formatToUrl } from '@op/common/validation';
import { Button } from '@op/ui/Button';
import { Header2, Header3 } from '@op/ui/Header';
import { Skeleton } from '@op/ui/Skeleton';
import { Tab, TabList, TabPanel } from '@op/ui/Tabs';
import { Tag, TagGroup } from '@op/ui/TagGroup';
import { toast } from '@op/ui/Toast';
import { cn } from '@op/ui/utils';
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
    <section className="text-neutral-charcoal flex flex-col gap-2">
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
    <section className="text-neutral-charcoal flex flex-col gap-2">
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
    <div className={cn('flex flex-col gap-2 sm:gap-6', className)}>
      {orgType ? (
        <Header2 className="text-title-sm font-serif leading-normal">
          {t('About')}
        </Header2>
      ) : null}
      <div className="border-neutral-gray1 flex flex-col gap-4 rounded border p-4 sm:rounded-none sm:border-none sm:p-0">
        {email || website ? (
          <section className="flex flex-col gap-2">
            <Header3>{t('Contact')}</Header3>
            <div className="text-teal flex flex-col">
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
          <section className="text-neutral-charcoal flex flex-col gap-2">
            <Header3>{t('Organizational Status')}</Header3>
            <TagGroup>
              <Tag className="capitalize">{orgType}</Tag>
            </TagGroup>
          </section>
        ) : null}

        {mission ? (
          <section className="text-neutral-charcoal flex flex-col gap-2">
            <Header3>{t('Mission Statement')}</Header3>
            <p>{mission}</p>
          </section>
        ) : null}

        {strategies?.length > 0 ? (
          <section className="text-neutral-charcoal flex flex-col gap-2">
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
              <section className="text-neutral-charcoal flex flex-col gap-2">
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
              <section className="text-neutral-charcoal flex flex-col gap-2">
                <Header3>{t('Communities We Serve')}</Header3>
                <div className="flex flex-wrap gap-2">
                  <Skeleton className="w-18 h-6" />
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
    ownerProfileId: profileId,
    status: ProcessStatus.PUBLISHED,
  });

  if (!data.items[0]) {
    return null;
  }

  return (
    <div className="sm:border-neutral-gray1 flex flex-col gap-2 px-4 pb-2 pt-0 sm:gap-0 sm:border-b sm:p-0 sm:pt-4">
      <Header2 className="text-title-sm px-6 font-serif leading-normal">
        {t('Decisions')}
      </Header2>
      {data.items.map((item, index) => (
        <Fragment key={item.id}>
          <ProfileDecisionListItem
            item={item}
            className="hover:sm:bg-primary-tealWhite border-neutral-gray1 rounded border p-4 transition-colors sm:rounded-none sm:border-none sm:px-6"
          />
          {index < data.items.length - 1 && <hr />}
        </Fragment>
      ))}
    </div>
  );
};

export const ProfileGridWrapper = ({ children }: { children: ReactNode }) => {
  return (
    <div className="grid-cols-15 hidden h-full grow sm:grid">{children}</div>
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
  const isOrg = user.currentProfile?.type === 'org';

  return (
    <ProfileGridWrapper>
      <div className="col-span-9 flex flex-col gap-8">
        {isOrg ? (
          <Suspense fallback={null}>
            <PostUpdate
              organization={profile}
              label={t('Post')}
              className="border-neutral-gray1 border-b px-4 pb-8 pt-6"
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
      <div className="border-neutral-gray1 col-span-6 h-full border-l">
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
  <TabList className="shrink-0 px-4 sm:px-6">{children}</TabList>
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
  const decisionsEnabled = checkModuleEnabled(
    profile.profile.modules,
    'decisions',
  );

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
      <TabList className="overflow-x-auto px-4">
        {!isIndividual && <Tab id="home">{t('Home')}</Tab>}
        {!isIndividual ? (
          <>
            <Tab id="updates">{t('Updates')}</Tab>
            <FollowersTab />
            <MembersTab profileId={profile.profile.id} />
            {decisionsEnabled && (
              <DecisionsTab profileId={profile.profile.id} />
            )}
          </>
        ) : (
          <>
            <Tab id="about">{t('About')}</Tab>
            <Tab id="organizations">{t('Organizations')}</Tab>
            <Tab id="following">{t('Following')}</Tab>
          </>
        )}
      </TabList>
      {!isIndividual && (
        <>
          <TabPanel id="home" className="px-0">
            <Suspense fallback={null}>
              <ProfileDecisions profileId={profile.profile.id} />
            </Suspense>
            <ProfileAbout profile={profile} className="px-4 py-2" />
            <Suspense fallback={<Skeleton className="min-h-20 w-full" />}>
              <div>
                <Header2 className="text-title-sm px-4 py-2 font-serif leading-normal">
                  {t('Posts')}
                </Header2>
                <ProfileFeedProvider profile={profile}>
                  {(props) => <ProfileFeedCards {...props} />}
                </ProfileFeedProvider>
              </div>
            </Suspense>
          </TabPanel>
          <TabPanel id="updates">
            <Suspense fallback={<Skeleton className="w-full" />}>
              <PostUpdate
                organization={profile}
                label={t('Post')}
                className="border-neutral-gray1 border-b px-4 pb-6 pt-2"
              />
            </Suspense>
            <Suspense fallback={<Skeleton className="min-h-20 w-full" />}>
              <ProfileFeedProvider profile={profile}>
                {(props) => (
                  <ProfileFeedList {...props} className="p-4 sm:py-6" />
                )}
              </ProfileFeedProvider>
            </Suspense>
          </TabPanel>
        </>
      )}

      {isIndividual && (
        <>
          <TabPanel id="about">
            <ProfileAbout profile={profile} className="px-4 py-2" />
          </TabPanel>
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
          {decisionsEnabled && (
            <MembersTabPanel profileId={profile.profile.id} />
          )}
        </>
      )}
      {decisionsEnabled && (
        <DecisionsTabPanel>{decisionsContent}</DecisionsTabPanel>
      )}
    </ProfileTabsWithQuery>
  );
};
