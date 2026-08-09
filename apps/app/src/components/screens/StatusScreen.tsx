import { Header1 } from '@op/sense/Header';
import type { ReactNode } from 'react';

/**
 * Shared layout for a big status screen (403/404/500…): a large code, a
 * description, and an optional action. Used by both `PageError` and
 * `ForbiddenScreen` so their styles stay in sync.
 */
export const StatusScreen = ({
  code,
  description,
  actions,
}: {
  code: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) => (
  <div className="flex size-full flex-col items-center justify-center gap-8 p-6">
    <div className="flex flex-col items-center gap-4">
      <Header1>{code}</Header1>
      {description}
    </div>
    {actions}
  </div>
);
