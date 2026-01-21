import type { SectionProps } from '../../content-registry';

export default function ProposalCategoriesSection({
  decisionId,
  decisionName,
}: SectionProps) {
  return (
    <div>
      <h2 className="text-xl font-semibold">Proposal Categories</h2>
      <p className="text-neutral-gray4">Decision: {decisionName}</p>
      <p className="text-neutral-gray4">ID: {decisionId}</p>
      {/* TODO: Implement proposal categories configuration */}
    </div>
  );
}
