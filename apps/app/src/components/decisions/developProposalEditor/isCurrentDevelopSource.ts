import { type ProcessInstance, ProposalStatus } from '@op/api/encoders';
import { type Proposal, isDevelopPhase } from '@op/common/client';

/**
 * Whether an entry of the current phase can be developed from the proposal:
 * a develop phase is current and the proposal is a submitted proposal of
 * this instance. Like `assertDevelopSources`, it takes a source from any
 * earlier phase.
 */
export function isCurrentDevelopSource({
  instance,
  proposal,
}: {
  instance: ProcessInstance;
  proposal: Proposal;
}): boolean {
  const currentPhase = instance.instanceData.phases?.find(
    (phase) => phase.phaseId === instance.currentStateId,
  );

  return (
    !!currentPhase &&
    isDevelopPhase(currentPhase) &&
    proposal.processInstanceId === instance.id &&
    proposal.status !== ProposalStatus.DRAFT &&
    proposal.status !== ProposalStatus.REJECTED
  );
}
