import { createClient } from '@op/api/serverClient';
import { redirect } from 'next/navigation';

import { InviteError } from './InviteError';

const AcceptProposalInvitePage = async ({
  params,
}: {
  params: Promise<{
    locale: string;
    slug: string;
    profileId: string;
    inviteId: string;
  }>;
}) => {
  const { locale, slug, profileId, inviteId } = await params;

  try {
    const client = await createClient();
    await client.decision.acceptProposalInvite({ inviteId });
  } catch {
    return <InviteError />;
  }

  redirect(`/${locale}/decisions/${slug}/proposal/${profileId}`);
};

export default AcceptProposalInvitePage;
