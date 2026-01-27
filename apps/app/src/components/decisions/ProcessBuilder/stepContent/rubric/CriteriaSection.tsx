import type { SectionProps } from '../../contentRegistry';

export default function CriteriaSection({
  decisionProfileId,
  decisionName,
}: SectionProps) {
  return (
    <div className="p-4 sm:p-8">
      <h2 className="text-xl font-semibold">Criteria</h2>
      <p className="text-neutral-gray4">Decision: {decisionName}</p>
      <p className="text-neutral-gray4">ID: {decisionProfileId}</p>
      {/* TODO: Implement rubric criteria configuration */}
    </div>
  );
}
