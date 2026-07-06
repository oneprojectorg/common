import { DecisionContentSkeleton } from '@/components/skeletons/DecisionSkeleton';

// Matches the hero + action bar + proposal list DecisionStateRouter renders;
// same skeleton the page's own Suspense fallback uses. Without this file the
// overview-shaped skeleton from the parent segment would show here instead.
export default function Loading() {
  return <DecisionContentSkeleton />;
}
