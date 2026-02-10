'use client';

import type { SectionProps } from '../../contentRegistry';
import { TemplateEditorContent } from './TemplateEditorContent';

export default function TemplateEditorSection({
  decisionProfileId,
  instanceId,
}: SectionProps) {
  return (
    <TemplateEditorContent
      decisionProfileId={decisionProfileId}
      instanceId={instanceId}
    />
  );
}
