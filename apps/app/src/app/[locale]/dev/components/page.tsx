import { notFound } from 'next/navigation';

import { ComparisonGrid } from '@op/ui-next/Comparison';

export const dynamic = 'force-static';

export default function DevComponentsPage() {
  if (process.env.NODE_ENV === 'production') {
    notFound();
  }
  return <ComparisonGrid />;
}
