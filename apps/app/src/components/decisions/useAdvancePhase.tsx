'use client';

import dynamic from 'next/dynamic';
import { usePostHog } from 'posthog-js/react';
import { type ReactNode, useCallback, useState } from 'react';

// Loaded on the first advance request, never at page load: the confirm dialog
// (Modal/Sheet/Toast + the mutation) is admin-only, so the non-admin viewers
// who make up nearly all decision-page traffic never fetch this chunk.
const AdvancePhaseConfirm = dynamic(
  () =>
    import('./AdvancePhaseConfirm').then(
      (module) => module.AdvancePhaseConfirm,
    ),
  { ssr: false },
);

interface UseAdvancePhaseArgs {
  instanceId?: string;
  /** Phase the process is currently in (the one being advanced out of). */
  currentPhaseId: string;
  /** Phase the process advances into. Undefined when there is no next phase. */
  nextPhaseId?: string;
  /** Translated names used in the confirmation copy. */
  currentPhaseName: string;
  nextPhaseName: string;
  /** Current phase end date, for the "advanced before deadline" tracking flag. */
  currentPhaseEndDate?: string;
}

interface UseAdvancePhaseResult {
  /** Open the confirmation dialog (and record the PostHog "initiated" event). */
  requestAdvance: () => void;
  /** The confirmation Modal/Sheet to render somewhere in the tree. */
  advanceConfirm: ReactNode;
}

/**
 * Owns the "advance to the next phase" flow shared by the phase stepper and the
 * overview phase timeline: PostHog tracking plus the lazily-loaded confirm
 * dialog (which owns the `transitionFromPhase` mutation and the toast +
 * refresh on success). Consumers render `advanceConfirm` and call
 * `requestAdvance` from whatever affordance triggers the advance.
 */
export function useAdvancePhase({
  instanceId,
  currentPhaseId,
  nextPhaseId,
  currentPhaseName,
  nextPhaseName,
  currentPhaseEndDate,
}: UseAdvancePhaseArgs): UseAdvancePhaseResult {
  const posthog = usePostHog();

  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  // Mount gate for the lazy chunk: stays false until the first advance
  // request, so `advanceConfirm` renders null (and nothing is fetched) for
  // viewers who never see an advance affordance.
  const [hasRequestedAdvance, setHasRequestedAdvance] = useState(false);

  const getTrackingProps = useCallback(
    () => ({
      process_instance_id: instanceId,
      from_phase_id: currentPhaseId,
      to_phase_id: nextPhaseId,
      before_end_date: currentPhaseEndDate
        ? isBeforeEndOfDayLocal(new Date(), currentPhaseEndDate)
        : null,
    }),
    [instanceId, currentPhaseId, nextPhaseId, currentPhaseEndDate],
  );

  const requestAdvance = useCallback(() => {
    posthog.capture('manual_transition_initiated', getTrackingProps());
    setHasRequestedAdvance(true);
    setIsConfirmOpen(true);
  }, [posthog, getTrackingProps]);

  const advanceConfirm = hasRequestedAdvance ? (
    <AdvancePhaseConfirm
      instanceId={instanceId}
      currentPhaseId={currentPhaseId}
      currentPhaseName={currentPhaseName}
      nextPhaseName={nextPhaseName}
      isOpen={isConfirmOpen}
      onClose={() => setIsConfirmOpen(false)}
      onDismissWithoutAdvance={() =>
        posthog.capture('manual_transition_dismissed', getTrackingProps())
      }
    />
  ) : null;

  return { requestAdvance, advanceConfirm };
}

// Phase end dates are persisted as ISO datetimes representing local midnight on
// the deadline day (see PhaseDetailPage formatDateValue). The deadline conceptually
// covers the entire day, so "before end date" must compare against the end of the
// stored day in local time, not its midnight start.
function isBeforeEndOfDayLocal(now: Date, endDate: string): boolean {
  const parsed = new Date(endDate);
  if (Number.isNaN(parsed.getTime())) {
    return false;
  }
  const endOfDayLocal = new Date(
    parsed.getFullYear(),
    parsed.getMonth(),
    parsed.getDate() + 1,
    0,
    0,
    0,
    0,
  );
  return now < endOfDayLocal;
}
