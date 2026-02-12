import { createClient } from '@op/api/serverClient';
import { redirect } from 'next/navigation';

import { InviteError } from './[inviteId]/InviteError';

const AcceptProposalInvitePage = async ({
  params,
}: {
  params: Promise<{
    locale: string;
    slug: string;
    profileId: string;
  }>;
}) => {
  const { locale, slug, profileId } = await params;

  try {
    const client = await createClient();
    await client.decision.acceptProposalInvite({ profileId });
  } catch {
    return <InviteError />;
  }

  redirect(`/${locale}/decisions/${slug}/proposal/${profileId}`);
};

export default AcceptProposalInvitePage;
