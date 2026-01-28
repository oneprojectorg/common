import type { SectionProps } from '../../contentRegistry';

export default function FormBuilderSection({
  decisionProfileId,
  decisionName,
}: SectionProps) {
  return (
    <div className="p-4 sm:p-8">
      <h2 className="text-title-base font-semibold">Form Builder</h2>
      <p className="text-neutral-gray4">Decision: {decisionName}</p>
      <p className="text-neutral-gray4">ID: {decisionProfileId}</p>
      {/* TODO: Implement form builder with custom sidebar */}
    </div>
  );
}
