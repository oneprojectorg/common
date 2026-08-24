import { ProposalRouteShell } from '../ProposalRouteShell';
import { EditProposalClient } from './EditProposalClient';

const EditProposalPage = async ({
  params,
}: {
  params: Promise<{ slug: string; profileId: string }>;
}) => {
  const { slug, profileId } = await params;

  return (
    <ProposalRouteShell slug={slug} profileId={profileId}>
      <EditProposalClient />
    </ProposalRouteShell>
  );
};

export default EditProposalPage;
