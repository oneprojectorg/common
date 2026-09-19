import { ProcessStatus } from '@op/api/encoders';

export type PublicAccessState = 'public' | 'openable' | 'unpublished';

/**
 * What the Public access section reports. `openable` is the only state that
 * offers the action: `makeDecisionPublic` refuses an unpublished decision, so
 * the control must not be there to click.
 *
 * Its own module, dependency-free, so the node test env can cover the rule
 * without pulling the client component's `next-intl` graph in with it.
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
