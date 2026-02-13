import { AllDecisions } from '@/components/decisions/AllDecisions';
import {
  ListPageLayout,
  ListPageLayoutHeader,
} from '@/components/layout/ListPageLayout';

const DecisionsListingPage = () => {
  return (
    <ListPageLayout className="gap-4 pt-8 sm:gap-6 sm:pt-12">
      <div className="flex flex-col gap-2">
        <ListPageLayoutHeader>Decision-making processes</ListPageLayoutHeader>
        <p className="text-neutral-charcoal">
          Discover new ways to collectively decide together.
        </p>
      </div>
      <AllDecisions />
    </ListPageLayout>
  );
};

export default DecisionsListingPage;
