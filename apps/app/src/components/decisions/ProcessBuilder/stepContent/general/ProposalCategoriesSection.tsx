'use client';

import { Suspense } from 'react';

import type { SectionProps } from '../../contentRegistry';
import { ProposalCategoriesSectionContent } from './ProposalCategoriesSectionContent';
import { ProposalCategoriesSectionSkeleton } from './ProposalCategoriesSectionSkeleton';

export default function ProposalCategoriesSection(props: SectionProps) {
  return (
    <Suspense fallback={<ProposalCategoriesSectionSkeleton />}>
      <ProposalCategoriesSectionContent {...props} />
    </Suspense>
  );
}
