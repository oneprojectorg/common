import type { SectionProps } from '../../contentRegistry';

export default function OverviewSection({
  decisionId,
  decisionName,
}: SectionProps) {
  return (
    <div>
      <h2 className="text-xl font-semibold">Overview</h2>
      <p className="text-neutral-gray4">Decision: {decisionName}</p>
      <p className="text-neutral-gray4">ID: {decisionId}</p>
      {/* TODO: Implement overview section */}
    </div>
  );
}
