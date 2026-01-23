import type { SectionProps } from '../../contentRegistry';

export default function RolesSection({
  decisionId,
  decisionName,
}: SectionProps) {
  return (
    <div className="p-4 sm:p-8">
      <h2 className="text-xl font-semibold">Roles &amp; Permissions</h2>
      <p className="text-neutral-gray4">Decision: {decisionName}</p>
      <p className="text-neutral-gray4">ID: {decisionId}</p>
      {/* TODO: Implement roles and permissions configuration */}
    </div>
  );
}
