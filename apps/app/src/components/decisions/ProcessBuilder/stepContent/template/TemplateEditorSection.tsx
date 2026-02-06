'use client';

import type { SectionProps } from '../../contentRegistry';
import { TemplateEditorContent } from './TemplateEditorContent';

export default function TemplateEditorSection({
  decisionProfileId,
}: SectionProps) {
  return <TemplateEditorContent decisionProfileId={decisionProfileId} />;
}
