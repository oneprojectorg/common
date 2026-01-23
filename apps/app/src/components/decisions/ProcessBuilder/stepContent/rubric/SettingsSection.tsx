import type { SectionProps } from '../../contentRegistry';

export default function SettingsSection({
  decisionId,
  decisionName,
}: SectionProps) {
  return (
    <div>
      <h2 className="text-xl font-semibold">Settings</h2>
      <p className="text-neutral-gray4">Decision: {decisionName}</p>
      <p className="text-neutral-gray4">ID: {decisionId}</p>
      {/* TODO: Implement rubric settings configuration */}
    </div>
  );
}
