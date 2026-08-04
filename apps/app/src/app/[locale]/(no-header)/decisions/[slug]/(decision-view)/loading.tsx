import { DecisionContentSkeleton } from '@/components/skeletons/DecisionSkeleton';

// This boundary belongs to the overview page (this segment's page.tsx); the
// header + tabs live in the persisted layout, so only the swapping content
// skeletons. /current has its own loading.tsx with the proposal-list shape.
export default function Loading() {
  return <DecisionContentSkeleton />;
}
