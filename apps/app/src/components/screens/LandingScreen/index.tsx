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

export const LandingScreen = () => {
  return (
    <HomeColumn>
      <Suspense fallback={<WelcomeSkeleton />}>
        <WelcomeSection />
      </Suspense>
      <Suspense fallback={null}>
        <UserContent />
      </Suspense>
      <ActiveProcesses />
      <NewlyJoinedModal />
    </HomeColumn>
  );
};

export const LandingScreenSkeleton = () => {
  return (
    <HomeColumn>
      <WelcomeSkeleton />
      <Skeleton className="h-36 w-full rounded-xl" />
      <Skeleton className="h-36 w-full rounded-xl" />
    </HomeColumn>
  );
};

const HomeColumn = ({ children }: { children: React.ReactNode }) => (
  <ListPageLayout>{children}</ListPageLayout>
);

const WelcomeSection = async () => {
  const [t, user] = await Promise.all([getTranslations(), getRequiredUser()]);

  return (
    // Tops the column's gap up to the layout's top padding, so the greeting sits evenly between them
    <div className="flex flex-col gap-2 pb-1 text-center sm:pb-5">
      <Welcome user={user} />
      <p className="text-muted-foreground">{t('shell.homeSubtitle')}</p>
    </div>
  );
};

const WelcomeSkeleton = async () => {
  const t = await getTranslations();

  return (
    <div className="flex flex-col gap-2 pb-1 sm:pb-5">
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
