import {
  DecisionHeaderBarSkeleton,
  OverviewSkeleton,
} from '@/components/skeletons/DecisionSkeleton';

// First-load skeleton for /decisions/[slug]: header bar (no stepper — the
// decision-view layout renders showStepper={false}) + overview-shaped content,
// since the overview is the canonical tab. Direct loads of /current briefly
// show this overview shape too; tab switches use the per-tab loading files
// inside (decision-view), which the persisted layout keeps mounted.
export default function Loading() {
  return (
    <div className="flex min-h-dvh flex-col">
      <DecisionHeaderBarSkeleton />
      <OverviewSkeleton />
    </div>
  );
}
