import * as React from 'react';

import { cn } from '../../lib/utils';
import { Button } from '../ui/button';

interface CookieBannerProps extends Omit<React.ComponentProps<'div'>, 'title'> {
  title: React.ReactNode;
  /**
   * Body copy. Takes a node rather than a string so the caller can put its
   * policy links inside the sentence — where they sit is a translation
   * decision, not a layout one.
   */
  description: React.ReactNode;
  rejectLabel: React.ReactNode;
  acceptLabel: React.ReactNode;
  onReject: () => void;
  onAccept: () => void;
}

/**
 * Cookie-consent banner: a persistent panel asking the visitor to accept or
 * reject analytics cookies.
 *
 * It takes the toast's surface, spacing and type scale, and positions itself in
 * the corner a toast would occupy, so it reads as the same object. It has no
 * close affordance and no auto-dismiss on purpose — it is the caller's job to
 * stop rendering it once the visitor has answered.
 *
 * Reject leads, and Accept carries the primary weight: the refusing action
 * should be the one that needs no hunting for, and the two must not be equally
 * hard to find.
 */
export function CookieBanner({
  title,
  description,
  rejectLabel,
  acceptLabel,
  onReject,
  onAccept,
  className,
  ...props
}: CookieBannerProps) {
  const titleId = React.useId();

  return (
    <div
      role="region"
      aria-labelledby={titleId}
      className={cn(
        // Geometry, surface and padding are `../ui/toast`'s viewport, root and
        // content, restated rather than shared: this panel sits in the toast
        // corner and has to read as the same object, but toast.tsx is generated
        // from the shadcn registry, so a wrapper extracted out of it would not
        // survive the next `shadcn add toast`.
        'fixed inset-x-4 bottom-4 z-50 mx-auto flex w-auto max-w-sm flex-col gap-3 rounded-lg border bg-popover p-4 text-popover-foreground shadow-lg sm:start-auto sm:end-4 sm:mx-0 sm:w-full',
        className,
      )}
      {...props}
    >
      <div className="flex flex-col gap-1">
        <p id={titleId} className="text-base font-strong">
          {title}
        </p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={onReject}>
          {rejectLabel}
        </Button>
        <Button size="sm" onClick={onAccept}>
          {acceptLabel}
        </Button>
      </div>
    </div>
  );
}
