import * as React from 'react';

import { cn } from '../../lib/utils';
import { Button } from '../ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../ui/card';

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
 * It positions itself in the corner a toast would occupy, so it reads as part
 * of the same notification surface. It has no close affordance and no
 * auto-dismiss on purpose — it is the caller's job to stop rendering it once
 * the visitor has answered.
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
    <Card
      role="region"
      aria-labelledby={titleId}
      className={cn(
        // Mirrors the toast viewport's geometry so the banner lands where a
        // toast would: full width inside the gutters on small screens, a
        // corner panel from `sm` up.
        'fixed inset-x-4 bottom-4 z-50 mx-auto w-auto max-w-sm shadow-lg sm:start-auto sm:end-4 sm:mx-0 sm:w-full',
        className,
      )}
      {...props}
    >
      <CardHeader>
        <CardTitle id={titleId}>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex gap-2">
        <Button variant="outline" size="sm" onClick={onReject}>
          {rejectLabel}
        </Button>
        <Button size="sm" onClick={onAccept}>
          {acceptLabel}
        </Button>
      </CardContent>
    </Card>
  );
}
