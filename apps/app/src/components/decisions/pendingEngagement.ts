import { z } from 'zod';

export const PENDING_ENGAGEMENT_PARAM = 'resume';

const PENDING_ENGAGEMENT_STORAGE_KEY = 'pendingEngagementProof';

export const savePendingEngagementProof = (raw: string): void => {
  try {
    globalThis.sessionStorage.setItem(PENDING_ENGAGEMENT_STORAGE_KEY, raw);
  } catch {
    return;
  }
};

export const readPendingEngagementProof = (): string | null => {
  try {
    return globalThis.sessionStorage.getItem(PENDING_ENGAGEMENT_STORAGE_KEY);
  } catch {
    return null;
  }
};

export const clearPendingEngagementProof = (): void => {
  try {
    globalThis.sessionStorage.removeItem(PENDING_ENGAGEMENT_STORAGE_KEY);
  } catch {
    return;
  }
};

export type EngagementAction = 'like' | 'follow';

export interface PendingEngagement {
  action: EngagementAction;
  profileId: string;
}

export type JoinTrigger = 'generic' | 'like' | 'follow';

const pendingEngagementSchema = z.object({
  action: z.enum(['like', 'follow']),
  profileId: z.uuid(),
});

export const parseJoinParam = (value: string | null): JoinTrigger | null => {
  if (!value) {
    return null;
  }
  if (value === 'like' || value === 'follow') {
    return value;
  }
  return 'generic';
};

export const joinPromptKeys = (trigger: JoinTrigger) =>
  trigger === 'follow'
    ? ({
        title: 'decisions.joinPromptFollowTitle',
        description: 'decisions.joinPromptFollowDescription',
      } as const)
    : ({
        title: 'decisions.joinPromptTitle',
        description: 'decisions.joinPromptDescription',
      } as const);

export const serializePendingEngagement = (
  pending: PendingEngagement,
): string => `${pending.action}:${pending.profileId}`;

export const parsePendingEngagement = (
  value: string | null,
): PendingEngagement | null => {
  if (!value) {
    return null;
  }
  const parts = value.split(':');
  if (parts.length !== 2) {
    return null;
  }
  const [action, profileId] = parts;
  const result = pendingEngagementSchema.safeParse({ action, profileId });
  return result.success ? result.data : null;
};

export const withPendingEngagement = (
  pathname: string,
  raw: string | null,
): string => {
  const pending = parsePendingEngagement(raw);
  if (!pending) {
    return pathname;
  }
  const params = new URLSearchParams({
    [PENDING_ENGAGEMENT_PARAM]: serializePendingEngagement(pending),
  });
  return `${pathname}?${params.toString()}`;
};

export type ResumeStep =
  | { type: 'idle' }
  | { type: 'clear' }
  | { type: 'wait' }
  | { type: 'fail' }
  | { type: 'apply'; shouldWrite: boolean };

export const decideResumeStep = ({
  raw,
  pending,
  hasProof,
  isJoinEligible,
  canInteract,
  canEngage,
  stateUnknown,
  lookupFailed,
  isLiked,
  isFollowed,
}: {
  raw: string | null;
  pending: PendingEngagement | null;
  hasProof: boolean;
  isJoinEligible: boolean;
  canInteract: boolean;
  canEngage: boolean;
  stateUnknown: boolean;
  lookupFailed: boolean;
  isLiked: boolean;
  isFollowed: boolean;
}): ResumeStep => {
  if (!raw) {
    return { type: 'idle' };
  }
  if (!pending) {
    return { type: 'clear' };
  }
  if (!hasProof) {
    return { type: 'clear' };
  }
  if (isJoinEligible) {
    return { type: 'wait' };
  }
  if (!canInteract || !canEngage) {
    return { type: 'fail' };
  }
  if (lookupFailed) {
    return { type: 'fail' };
  }
  if (stateUnknown) {
    return { type: 'wait' };
  }
  const already = pending.action === 'like' ? isLiked : isFollowed;
  return { type: 'apply', shouldWrite: !already };
};
