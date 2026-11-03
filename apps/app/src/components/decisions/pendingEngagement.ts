export const PENDING_ENGAGEMENT_PARAM = 'resume';

export type EngagementAction = 'like' | 'follow';

export interface PendingEngagement {
  action: EngagementAction;
  profileId: string;
}

export type JoinTrigger = 'generic' | 'like' | 'follow';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
  if (action !== 'like' && action !== 'follow') {
    return null;
  }
  if (!profileId || !UUID_RE.test(profileId)) {
    return null;
  }
  return { action, profileId };
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
  isJoinEligible,
  canInteract,
  canEngage,
  stateUnknown,
  isLiked,
  isFollowed,
}: {
  raw: string | null;
  pending: PendingEngagement | null;
  isJoinEligible: boolean;
  canInteract: boolean;
  canEngage: boolean;
  stateUnknown: boolean;
  isLiked: boolean;
  isFollowed: boolean;
}): ResumeStep => {
  if (!raw) {
    return { type: 'idle' };
  }
  if (!pending) {
    return { type: 'clear' };
  }
  if (isJoinEligible) {
    return { type: 'wait' };
  }
  if (!canInteract || !canEngage) {
    return { type: 'fail' };
  }
  if (stateUnknown) {
    return { type: 'wait' };
  }
  const already = pending.action === 'like' ? isLiked : isFollowed;
  return { type: 'apply', shouldWrite: !already };
};
