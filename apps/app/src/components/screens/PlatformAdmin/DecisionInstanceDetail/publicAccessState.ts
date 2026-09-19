import { ProcessStatus } from '@op/api/encoders';

export type PublicAccessState = 'public' | 'openable' | 'unpublished';

/**
 * What the Public access section reports. `openable` is the only state that
 * offers the action: `makeDecisionPublic` refuses an unpublished decision, so
 * the control must not be there to click.
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
