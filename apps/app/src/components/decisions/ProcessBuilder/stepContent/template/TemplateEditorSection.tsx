'use client';

import { Suspense } from 'react';

import type { SectionProps } from '../../contentRegistry';
import { TemplateEditorContent } from './TemplateEditorContent';
import { TemplateEditorSkeleton } from './TemplateEditorSkeleton';

export default function TemplateEditorSection(props: SectionProps) {
  return (
    <Suspense fallback={<TemplateEditorSkeleton />}>
      <TemplateEditorContent {...props} />
    </Suspense>
  );
}
