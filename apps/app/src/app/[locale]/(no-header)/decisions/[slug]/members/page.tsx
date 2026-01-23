import { createClient } from '@op/api/serverClient';
import { notFound } from 'next/navigation';

import { TranslatedText } from '@/components/TranslatedText';
import { ProfileUsersAccessHeader } from '@/components/decisions/ProfileUsersAccessHeader';
import { ProfileUsersAccessPage } from '@/components/decisions/ProfileUsersAccessPage';

const ProfileMembersContent = async ({ slug }: { slug: string }) => {
  const client = await createClient();

  const decisionProfile = await client.decision.getDecisionBySlug({
    slug,
  });

  if (!decisionProfile || !decisionProfile.processInstance) {
    notFound();
  }

  const profileId = decisionProfile.id;
  const ownerSlug = decisionProfile.processInstance.owner?.slug;
  const decisionName =
    decisionProfile.processInstance.process?.name ||
    decisionProfile.processInstance.name;

  if (!ownerSlug) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-neutral-offWhite">
      <ProfileUsersAccessHeader
        backTo={{
          label: decisionName,
          href: `/decisions/${slug}`,
        }}
        title={<TranslatedText text="Members" />}
      />
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <ProfileUsersAccessPage profileId={profileId} />
      </div>
    </div>
  );
};

const MembersPage = async ({
  params,
}: {
  params: Promise<{ slug: string }>;
}) => {
  const { slug } = await params;

  return <ProfileMembersContent slug={slug} />;
};

export default MembersPage;
