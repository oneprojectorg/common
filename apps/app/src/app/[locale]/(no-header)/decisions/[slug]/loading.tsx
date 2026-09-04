import {
  DecisionContentSkeleton,
  DecisionHeaderBarSkeleton,
} from '@/components/skeletons/DecisionSkeleton';

// First-load skeleton for /decisions/[slug]: header bar (no stepper — the
// decision-view layout renders showStepper={false}) + overview-shaped content,
// since the overview is the canonical tab. Direct loads of /current briefly
// show this overview shape too; tab switches use the per-tab loading files
// inside (decision-view), which the persisted layout keeps mounted.
//
// The shell mirrors the (decision-view) layout's grid — h-dvh with scroll
// confined to the content row — so the scrollbar lives in the same place
// during load and after resolve (no gutter shift, no scroll-position reset).
export default function Loading() {
  return (
    <div className="grid h-dvh grid-rows-[auto_1fr]">
      <DecisionHeaderBarSkeleton />
      <div className="overflow-x-clip overflow-y-auto">
        <DecisionContentSkeleton />
      </div>
    </div>
  );
}
