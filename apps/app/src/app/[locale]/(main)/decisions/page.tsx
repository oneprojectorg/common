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
      <ListPageLayout className="gap-4 pt-12 sm:gap-8 sm:pt-12">
        <div className="flex flex-col gap-2">
          <ListPageLayoutHeader>Decision-making processes</ListPageLayoutHeader>
          <p className="text-sm text-neutral-charcoal">
            Discover new ways to collectively decide together.
          </p>
        </div>
        <AllDecisions initialData={decisions} />
      </ListPageLayout>
    );
  } catch (error) {
    return (
      <ListPageLayout className="gap-4 pt-12 sm:gap-8 sm:pt-12">
        <div className="flex flex-col gap-2">
          <ListPageLayoutHeader>Decision-making processes</ListPageLayoutHeader>
          <p className="text-sm text-neutral-charcoal">
            Discover new ways to collectively decide together.
          </p>
        </div>
        <AllDecisions
          initialData={{ items: [], hasMore: false, next: null }}
        />
      </ListPageLayout>
    );
  }
};

export default DecisionsListingPage;
