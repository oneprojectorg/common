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
    <section className="gap-2 flex flex-col text-neutral-charcoal">
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
    <section className="gap-2 flex flex-col text-neutral-charcoal">
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
    <div className={cn('gap-2 sm:gap-6 flex flex-col', className)}>
      {orgType ? (
        <Header2 className="leading-normal font-serif text-title-sm">
          {t('About')}
        </Header2>
      ) : null}
      <div className="gap-4 p-4 sm:rounded-none sm:border-none sm:p-0 flex flex-col rounded border border-neutral-gray1">
        {email || website ? (
          <section className="gap-2 flex flex-col">
            <Header3>{t('Contact')}</Header3>
            <div className="text-teal flex flex-col">
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
          <section className="gap-2 flex flex-col text-neutral-charcoal">
            <Header3>{t('Organizational Status')}</Header3>
            <TagGroup>
              <Tag className="capitalize">{orgType}</Tag>
            </TagGroup>
          </section>
        ) : null}

        {mission ? (
          <section className="gap-2 flex flex-col text-neutral-charcoal">
            <Header3>{t('Mission Statement')}</Header3>
            <p>{mission}</p>
          </section>
        ) : null}

        {strategies?.length > 0 ? (
          <section className="gap-2 flex flex-col text-neutral-charcoal">
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
              <section className="gap-2 flex flex-col text-neutral-charcoal">
                <Header3>{t('Focus Areas')}</Header3>
                <div className="gap-2 flex flex-wrap">
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
              <section className="gap-2 flex flex-col text-neutral-charcoal">
                <Header3>{t('Communities We Serve')}</Header3>
                <div className="gap-2 flex flex-wrap">
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
    ownerProfileId: profileId,
    status: ProcessStatus.PUBLISHED,
  });

  if (!data.items[0]) {
    return null;
  }

  return (
    <div className="sm:border-neutral-gray1 gap-2 px-4 pb-2 pt-0 sm:gap-0 sm:border-b sm:p-0 sm:pt-4 flex flex-col">
      <Header2 className="px-6 leading-normal font-serif text-title-sm">
        {t('Decisions')}
      </Header2>
      {data.items.map((item, index) => (
        <Fragment key={item.id}>
          <ProfileDecisionListItem
            item={item}
            className="hover:sm:bg-primary-tealWhite p-4 sm:rounded-none sm:border-none sm:px-6 rounded border border-neutral-gray1 transition-colors"
          />
          {index < data.items.length - 1 && <hr />}
        </Fragment>
      ))}
    </div>
  );
};

export const ProfileGridWrapper = ({ children }: { children: ReactNode }) => {
  return (
    <div className="sm:grid hidden h-full grow grid-cols-15">{children}</div>
  );
};

export const ProfileGrid = ({ profile }: { profile: Organization }) => {
  return (
    <ProfileGridWrapper>
      <div className="p-6 col-span-6">
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
      <div className="gap-8 col-span-9 flex flex-col">
        {isOrg ? (
          <Suspense fallback={null}>
            <PostUpdate
              organization={profile}
              label={t('Post')}
              className="px-4 pb-8 pt-6 border-b border-neutral-gray1"
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
      <div className="col-span-6 h-full border-l border-neutral-gray1">
        <Suspense fallback={null}>
          <ProfileDecisions profileId={profile.profile.id} />
        </Suspense>
        <div className="gap-4 px-6 py-4 flex flex-col">
          <ProfileAbout profile={profile} />
        </div>
      </div>
    </ProfileGridWrapper>
  );
};

export const ProfileTabList = ({ children }: { children: React.ReactNode }) => (
  <TabList className="px-4 sm:px-6 shrink-0">{children}</TabList>
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
      className="gap-0 px-0 sm:flex sm:h-full sm:flex-col hidden grow"
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
      <TabList className="px-4 overflow-x-auto">
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
                <Header2 className="px-4 py-2 leading-normal font-serif text-title-sm">
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
                className="px-4 pb-6 pt-2 border-b border-neutral-gray1"
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
            <div className="gap-4 flex flex-col">{children}</div>
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
