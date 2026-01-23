import type { SectionProps } from '../../contentRegistry';

export default function FormBuilderSection({
  decisionId,
  decisionName,
}: SectionProps) {
  return (
    <div>
      <h2 className="text-xl font-semibold">Form Builder</h2>
      <p className="text-neutral-gray4">Decision: {decisionName}</p>
      <p className="text-neutral-gray4">ID: {decisionId}</p>
      {/* TODO: Implement form builder with custom sidebar */}
    </div>
  );
}
