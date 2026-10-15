import { getRequiredUser } from '@/utils/getUser';
import { Organization } from '@op/api/encoders';
import { Header1 } from '@op/sense/Header';
import { Skeleton } from '@op/sense/Skeleton';
import { Suspense } from 'react';

import { getTranslations } from '@/lib/i18n';

import { JoinProfileRequestsNotifications } from '@/components/JoinProfileRequestsNotifications';
import { NewlyJoinedModal } from '@/components/NewlyJoinedModal';
import { PendingDecisionInvites } from '@/components/PendingDecisionInvites';
import { PendingRelationships } from '@/components/PendingRelationships';
import { RevisionRequestNotifications } from '@/components/RevisionRequestNotifications';
import { ListPageLayout } from '@/components/layout/ListPageLayout';

import { ActiveProcesses } from './ActiveProcesses';
import { SetUpProfilePrompt } from './SetUpProfilePrompt';
import { Welcome } from './Welcome';

/**
 * The home page (Figma 21477:62716): a greeting, anything waiting on the user
 * (profile setup, invites, revision and relationship requests), then the
 * processes they belong to. The org-posts feed lives at /updates.
 */
export const LandingScreen = ({ locale }: { locale: string }) => {
  return (
    <HomeColumn>
      <Suspense fallback={<WelcomeSkeleton locale={locale} />}>
        <WelcomeSection locale={locale} />
      </Suspense>
      <Suspense fallback={null}>
        <UserContent />
      </Suspense>
      <ActiveProcesses />
      <NewlyJoinedModal />
    </HomeColumn>
  );
};

export const LandingScreenSkeleton = ({ locale }: { locale: string }) => {
  return (
    <HomeColumn>
      <WelcomeSkeleton locale={locale} />
      <Skeleton className="h-36 w-full rounded-xl" />
      <Skeleton className="h-36 w-full rounded-xl" />
    </HomeColumn>
  );
};

const HomeColumn = ({ children }: { children: React.ReactNode }) => (
  <ListPageLayout>{children}</ListPageLayout>
);

const WelcomeSection = async ({ locale }: { locale: string }) => {
  const [t, user] = await Promise.all([
    getTranslations({ locale }),
    getRequiredUser(),
  ]);

  return (
    <div className="flex flex-col gap-2 text-center">
      <Welcome user={user} />
      <p>{t('shell.homeSubtitle')}</p>
    </div>
  );
};

const WelcomeSkeleton = async ({ locale }: { locale: string }) => {
  const t = await getTranslations({ locale });

  return (
    <div className="flex flex-col gap-2">
      <Skeleton>
        <Header1 className="text-center text-transparent">
          {t('shell.welcomeBackTitle')}
        </Header1>
      </Skeleton>
      <Skeleton className="text-center text-transparent">
        {t('shell.homeSubtitle')}
      </Skeleton>
    </div>
  );
};

const UserContent = async () => {
  const user = await getRequiredUser();

  return (
    <>
      {user.currentProfile?.type === 'org' ? null : <SetUpProfilePrompt />}
      <PendingDecisionInvites />
      <RevisionRequestNotifications />
      {user.currentProfile?.type === 'org' ? (
        <OrgNotifications currentProfile={user.currentProfile} />
      ) : null}
    </>
  );
};

/**
 * Join requests and pending relationships, for a user acting as an org.
 */
const OrgNotifications = (props: {
  currentProfile: Organization['profile'];
}) => {
  const { currentProfile } = props;

  return (
    <>
      <JoinProfileRequestsNotifications targetProfileId={currentProfile.id} />
      <PendingRelationships slug={currentProfile.slug} />
    </>
  );
};
