import { db, eq, inArray } from '@op/db/client';
import {
  decisionProcessResultSelections,
  profiles,
  stateTransitionHistory,
  users,
} from '@op/db/schema';

import { CommonError } from '../../utils';
import { hasEmail } from '../../utils/email';
import {
  type EmailRecipient,
  listMemberProfileRecipientsByProfile,
} from '../email/recipients';
import { getProposalIdsForPhase } from './getProposalsForPhase';
import { normalizeBudget } from './proposalDataSchema';
import {
  type ResultNotificationMessages,
  type ResultNotificationOutcome,
  type ResultNotificationValues,
  formatResultAmount,
  resultNotificationMessagesSchema,
} from './resultNotificationTemplate';
import type { TransitionData } from './schemas/transitionData';
import { isProposalReachable } from './utils/proposal';

const DEFAULT_GREETING_NAME = 'there';

export interface ResultNotificationRecipient {
  email: string;
  /** App URLs address a proposal by its profile id, not its own id. */
  proposalProfileId: string;
  outcome: ResultNotificationOutcome;
  values: ResultNotificationValues;
}

export interface ResultNotification {
  processTitle: string;
  processProfileSlug: string;
  messages: ResultNotificationMessages;
  recipients: Array<ResultNotificationRecipient>;
}

export type ListResultNotificationRecipientsResult =
  | { ok: true; notification: ResultNotification }
  | { ok: false; reason: 'resultRetired' | 'noRecipients' };

/**
 * Who hears how the decision went, and the copy they need.
 *
 * Addresses the exact `decision_process_results` row that was published rather
 * than the latest successful one: `revertPhase` retires rows by flipping
 * `success`, and re-resolving after a revert would read an empty selection set
 * and tell every author they were not selected.
 */
export async function listResultNotificationRecipients({
  processInstanceId,
  processResultId,
  transitionHistoryId,
  previousPhaseId,
}: {
  processInstanceId: string;
  processResultId: string;
  transitionHistoryId: string;
  /** The phase whose membership defines the not-selected audience. */
  previousPhaseId: string;
}): Promise<ListResultNotificationRecipientsResult> {
  const [resultRow, instance, messages] = await Promise.all([
    db.query.decisionProcessResults.findFirst({
      where: { id: processResultId, processInstanceId },
    }),
    db.query.processInstances.findFirst({
      where: { id: processInstanceId },
      with: { profile: true },
    }),
    readComposedMessages(transitionHistoryId),
  ]);

  // Retracted inside the debounce window, or never ours to begin with.
  if (!resultRow?.success) {
    return { ok: false, reason: 'resultRetired' };
  }

  if (!instance?.profile) {
    throw new CommonError(
      `Process instance ${processInstanceId} has no associated profile`,
    );
  }

  if (!messages) {
    throw new CommonError(
      `Transition ${transitionHistoryId} carries no author notifications`,
    );
  }

  const [selections, candidateIds] = await Promise.all([
    db
      .select({
        proposalId: decisionProcessResultSelections.proposalId,
        allocated: decisionProcessResultSelections.allocated,
      })
      .from(decisionProcessResultSelections)
      .where(
        eq(decisionProcessResultSelections.processResultId, processResultId),
      ),
    getProposalIdsForPhase({ instance, phaseId: previousPhaseId }),
  ]);

  const allocatedByProposalId = new Map(
    selections.map(({ proposalId, allocated }) => [proposalId, allocated]),
  );
  // Selected comes from the result row, not the candidate pool: a proposal
  // created inside the final phase's own window can be selected without ever
  // belonging to the previous phase.
  const notSelectedIds = candidateIds.filter(
    (id) => !allocatedByProposalId.has(id),
  );
  const proposalIds = [...allocatedByProposalId.keys(), ...notSelectedIds];

  if (proposalIds.length === 0) {
    return { ok: false, reason: 'noRecipients' };
  }

  const proposals = await db.query.proposals.findMany({
    where: { id: { in: proposalIds } },
    with: { profile: true },
  });

  const reachable = proposals.filter(isProposalReachable);
  const audiences = await listMemberProfileRecipientsByProfile(
    reachable.map(({ profileId }) => profileId),
  );
  const names = await readAuthorNames(
    [...audiences.values()].flat().map(({ authUserId }) => authUserId),
  );

  const recipients = reachable.flatMap((proposal) =>
    toRecipients({
      proposal,
      allocated: allocatedByProposalId.get(proposal.id),
      audience: audiences.get(proposal.profileId) ?? [],
      names,
    }),
  );

  if (recipients.length === 0) {
    return { ok: false, reason: 'noRecipients' };
  }

  // The batch sender's idempotency keys are chunk-index based, so a retry has
  // to rebuild the same list in the same order.
  recipients.sort(
    (a, b) =>
      a.proposalProfileId.localeCompare(b.proposalProfileId) ||
      a.email.localeCompare(b.email),
  );

  return {
    ok: true,
    notification: {
      processTitle: instance.name,
      processProfileSlug: instance.profile.slug,
      messages,
      recipients,
    },
  };
}

/**
 * One message per (author, proposal). `allocated` is `undefined` for a proposal
 * the result row did not select, and `null` for one it selected without an
 * amount.
 */
function toRecipients({
  proposal,
  allocated,
  audience,
  names,
}: {
  proposal: {
    id: string;
    profileId: string;
    proposalData: unknown;
    profile: { name: string };
  };
  allocated: string | null | undefined;
  audience: Array<EmailRecipient>;
  names: Map<string, string>;
}): Array<ResultNotificationRecipient> {
  const outcome: ResultNotificationOutcome =
    allocated === undefined ? 'notSelected' : 'selected';
  const amount =
    outcome === 'selected'
      ? formatResultAmount({
          allocated: allocated ?? null,
          budget: normalizeBudget(
            (proposal.proposalData as { budget?: unknown } | null)?.budget,
          ),
        })
      : '';

  const seen = new Set<string>();

  return audience.filter(hasEmail).flatMap(({ authUserId, email }) => {
    const key = email.toLowerCase();
    if (seen.has(key)) {
      return [];
    }
    seen.add(key);

    return [
      {
        email,
        proposalProfileId: proposal.profileId,
        outcome,
        values: {
          name: names.get(authUserId) ?? DEFAULT_GREETING_NAME,
          proposal: proposal.profile.name,
          amount,
        },
      },
    ];
  });
}

/**
 * Best-effort: `users.profileId` is nullable and an invited collaborator may
 * have no `users` row at all, so a missing name means a generic greeting,
 * never a dropped recipient.
 */
async function readAuthorNames(
  authUserIds: Array<string>,
): Promise<Map<string, string>> {
  if (authUserIds.length === 0) {
    return new Map();
  }

  const rows = await db
    .select({
      authUserId: users.authUserId,
      profileName: profiles.name,
      userName: users.name,
    })
    .from(users)
    .leftJoin(profiles, eq(profiles.id, users.profileId))
    .where(inArray(users.authUserId, [...new Set(authUserIds)]));

  return new Map(
    rows.flatMap(({ authUserId, profileName, userName }) => {
      const name = profileName ?? userName;
      return name ? [[authUserId, name] as const] : [];
    }),
  );
}

/**
 * Addressed by id rather than the latest transition: any row written afterwards
 * would hide the messages and silently send nothing. Re-validated because
 * `transitionData` is a shared jsonb bag several writers touch.
 */
async function readComposedMessages(
  transitionHistoryId: string,
): Promise<ResultNotificationMessages | undefined> {
  const [row] = await db
    .select({ transitionData: stateTransitionHistory.transitionData })
    .from(stateTransitionHistory)
    .where(eq(stateTransitionHistory.id, transitionHistoryId))
    .limit(1);

  const transitionData = row?.transitionData as TransitionData | null;
  const parsed = resultNotificationMessagesSchema.safeParse(
    transitionData?.manualSelection?.resultNotifications,
  );

  return parsed.success ? parsed.data : undefined;
}
