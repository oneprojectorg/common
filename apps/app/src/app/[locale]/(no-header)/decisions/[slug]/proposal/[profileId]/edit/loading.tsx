import { ProposalEditorSkeleton } from '@/components/decisions/ProposalEditorSkeleton';

// The editor's own boundary. It used to inherit one from `[profileId]`, which
// now lives inside the `(view)` group, so the shape is declared here instead of
// being borrowed from the sibling route.
export default function Loading() {
  return <ProposalEditorSkeleton />;
}
