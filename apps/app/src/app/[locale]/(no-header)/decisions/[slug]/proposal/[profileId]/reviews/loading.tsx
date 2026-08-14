import { Skeleton } from '@op/sense/Skeleton';

/**
 * Neutral shell for the proposal-keyed reviews URL. The screen behind this URL
 * differs per viewer (admin summary vs. reviewer split pane), so the route
 * fallback commits to no shape below the navbar: it is only on screen for the
 * slug fetch that picks the branch, and each branch then streams in behind its
 * own correctly shaped skeleton.
 */
export default function Loading() {
  return (
    <div className="flex h-dvh flex-col bg-white">
      <div className="flex h-14 shrink-0 items-center justify-between border-b px-6 md:px-8">
        <Skeleton className="h-5 w-36" />
      </div>
    </div>
  );
}
