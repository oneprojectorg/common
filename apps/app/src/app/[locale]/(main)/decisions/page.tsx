import { ProcessStatus } from '@op/api/encoders';
import { createClient } from '@op/api/serverClient';

import { AllDecisions } from '@/components/decisions/AllDecisions';
import {
  ListPageLayout,
  ListPageLayoutHeader,
} from '@/components/layout/ListPageLayout';

export const dynamic = 'force-dynamic';

const DecisionsListingPage = async () => {
  try {
    const client = await createClient();
    const decisions = await client.decision.listDecisionProfiles({
      limit: 20,
      status: ProcessStatus.PUBLISHED,
    });

    return (
      <ListPageLayout>
        <ListPageLayoutHeader>Decision-making processes</ListPageLayoutHeader>
        <p className="-mt-2 text-sm text-neutral-charcoal sm:-mt-4">
          Discover new ways to collectively decide together.
        </p>
        <AllDecisions initialData={decisions} />
      </ListPageLayout>
    );
  } catch (error) {
    return (
      <ListPageLayout>
        <ListPageLayoutHeader>Decision-making processes</ListPageLayoutHeader>
        <p className="-mt-2 text-sm text-neutral-charcoal sm:-mt-4">
          Discover new ways to collectively decide together.
        </p>
        <AllDecisions
          initialData={{ items: [], hasMore: false, next: null }}
        />
      </ListPageLayout>
    );
  }
};

export default DecisionsListingPage;
