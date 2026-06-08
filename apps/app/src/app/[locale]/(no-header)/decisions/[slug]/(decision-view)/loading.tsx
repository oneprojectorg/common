import { DecisionContentSkeleton } from '@/components/skeletons/DecisionSkeleton';

// Content-only: the header + tabs live in the persisted layout, so a tab
// switch should skeleton just the swapping content, not the whole page.
export default function Loading() {
  return <DecisionContentSkeleton />;
}
