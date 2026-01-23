import type { SectionProps } from '../../contentRegistry';

export default function ProposalCategoriesSection({
  decisionId,
  decisionName,
}: SectionProps) {
  return (
    <div className="p-4 sm:p-8">
      <h2 className="text-xl font-semibold">Proposal Categories</h2>
      <p className="text-neutral-gray4">Decision: {decisionName}</p>
      <p className="text-neutral-gray4">ID: {decisionId}</p>
      {/* TODO: Implement proposal categories configuration */}
    </div>
  );
}
