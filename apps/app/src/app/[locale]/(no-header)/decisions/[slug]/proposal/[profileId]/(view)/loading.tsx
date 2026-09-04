import { ProposalEditorSkeleton } from '@/components/decisions/ProposalEditorSkeleton';

// Scoped to the `(view)` group, not to `[profileId]`: a `loading.tsx` at the
// segment level wraps every nested segment too, so `reviews/` used to paint
// this proposal-shaped fallback before its own. The group keeps this boundary
// around the proposal view alone; `reviews/` and `edit/` are siblings with
// their own.
export default function Loading() {
  return <ProposalEditorSkeleton />;
}
