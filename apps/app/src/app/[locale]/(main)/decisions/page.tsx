import { DecisionProfileList, ProcessStatus } from '@op/api/encoders';
import { createClient } from '@op/api/serverClient';

import { AllDecisions } from '@/components/decisions/AllDecisions';
import {
  ListPageLayout,
  ListPageLayoutHeader,
} from '@/components/layout/ListPageLayout';

export const dynamic = 'force-dynamic';

const DecisionsListingPage = async () => {
  let decisions: DecisionProfileList = {
    items: [],
    hasMore: false,
    next: null,
  };

  try {
    const client = await createClient();
    decisions = await client.decision.listDecisionProfiles({
      limit: 20,
      status: ProcessStatus.PUBLISHED,
    });
  } catch (error) {
    // log error but return the empty list
    console.log(error);
  }

  return (
    <ListPageLayout className="gap-4 pt-8 sm:gap-6 sm:pt-12">
      <div className="flex flex-col gap-2">
        <ListPageLayoutHeader>Decision-making processes</ListPageLayoutHeader>
        <p className="text-neutral-charcoal">
          Discover new ways to collectively decide together.
        </p>
      </div>
      <AllDecisions initialData={decisions} />
    </ListPageLayout>
  );
};

export default DecisionsListingPage;
