import { ProcessBuilderHeader } from '@/components/decisions/ProcessBuilder/ProcessBuilderHeader';
import { ProcessBuilderProcessSelector } from '@/components/decisions/ProcessBuilder/ProcessBuilderProcessSelector';

const NewDecisionPage = () => {
  return (
    <div className="flex size-full flex-col">
      <ProcessBuilderHeader />
      <ProcessBuilderProcessSelector />
    </div>
  );
};

export default NewDecisionPage;
