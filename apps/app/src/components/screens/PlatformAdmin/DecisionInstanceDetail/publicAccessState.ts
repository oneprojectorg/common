import { ProcessStatus } from '@op/api/encoders';

export type PublicAccessState = 'public' | 'openable' | 'unpublished';

/**
 * `openable` is the only state that offers the action — the service refuses an
 * unpublished decision. Kept dependency-free so a node test can cover it.
 */
export const getPublicAccessState = ({
  isPublic,
  status,
}: {
  isPublic: boolean;
  status: ProcessStatus | null;
}): PublicAccessState => {
  if (isPublic) {
    return 'public';
  }

  return status === ProcessStatus.PUBLISHED ? 'openable' : 'unpublished';
};
