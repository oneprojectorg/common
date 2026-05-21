import { ComparisonGrid } from '@op/ui/Comparison';
import { notFound } from 'next/navigation';

export const dynamic = 'force-static';

export default function DevComponentsPage() {
  if (process.env.NODE_ENV === 'production') {
    notFound();
  }
  return <ComparisonGrid />;
}
