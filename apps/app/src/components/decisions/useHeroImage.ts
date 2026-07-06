'use client';

import { trpc } from '@op/api/client';

import { useHeroImageUpload } from './useHeroImageUpload';

/**
 * Upload/remove logic for a decision hero banner, scoped to either the overview
 * (no `phaseId`) or a single phase (`phaseId`). Thin wrapper over
 * {@link useHeroImageUpload} wired to the matching tRPC mutations. `onChange`
 * lets a live page refresh after a change.
 */
export function useHeroImage({
  instanceId,
  phaseId,
  initialPath,
  onChange,
}: {
  instanceId: string;
  /** When set, targets that phase's banner; otherwise the overview banner. */
  phaseId?: string;
  initialPath?: string;
  onChange?: () => void;
}) {
  const signOverview =
    trpc.decision.signOverviewHeroImageUploadUrl.useMutation();
  const recordOverview = trpc.decision.updateOverviewHeroImage.useMutation();
  const removeOverview = trpc.decision.removeOverviewHeroImage.useMutation();
  const signPhase = trpc.decision.signPhaseHeroImageUploadUrl.useMutation();
  const recordPhase = trpc.decision.updatePhaseHeroImage.useMutation();
  const removePhase = trpc.decision.removePhaseHeroImage.useMutation();

  const isPhase = phaseId !== undefined;
  const signMutation = isPhase ? signPhase : signOverview;
  const recordMutation = isPhase ? recordPhase : recordOverview;
  const removeMutation = isPhase ? removePhase : removeOverview;

  return useHeroImageUpload({
    initialPath,
    onChange,
    sign: (fileName) =>
      phaseId !== undefined
        ? signPhase.mutateAsync({ instanceId, phaseId, fileName })
        : signOverview.mutateAsync({ instanceId, fileName }),
    record: ({ storagePath, mimeType }) =>
      phaseId !== undefined
        ? recordPhase.mutateAsync({
            instanceId,
            phaseId,
            storagePath,
            mimeType,
          })
        : recordOverview.mutateAsync({ instanceId, storagePath, mimeType }),
    remove: () =>
      phaseId !== undefined
        ? removePhase.mutateAsync({ instanceId, phaseId })
        : removeOverview.mutateAsync({ instanceId }),
    isRemoving: removeMutation.isPending,
    uploadError:
      signMutation.error?.message ?? recordMutation.error?.message ?? undefined,
  });
}
