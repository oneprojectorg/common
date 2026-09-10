import * as React from 'react';

import { cn } from '../../lib/utils';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
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
 * It is an `Alert` that positions itself in the corner a toast would occupy, so
 * it reads as part of the same notification surface. It has no close affordance
 * and no auto-dismiss on purpose — it is the caller's job to stop rendering it
 * once the visitor has answered.
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
    <Alert
      // `Alert` is `role="alert"` — an assertive live region, which would
      // interrupt a screen reader mid-sentence on every cold load. This is a
      // standing panel the visitor navigates to when ready, so it declares
      // itself a landmark instead.
      role="region"
      aria-labelledby={titleId}
      className={cn(
        // Everything except where it sits comes from `Alert`: rounding, border,
        // surface, padding and the title's type. What's left is the "floating
        // in the corner a toast would occupy" part, which no primitive owns.
        'fixed inset-x-4 bottom-4 z-50 mx-auto w-auto max-w-sm shadow-lg sm:start-auto sm:end-4 sm:mx-0 sm:w-full',
        className,
      )}
      {...props}
    >
      <AlertTitle id={titleId}>{title}</AlertTitle>
      {/* `text-sm` matches the toast scale this panel sits beside rather than
          `Alert`'s roomier in-page default. `text-wrap` undoes its
          `text-balance md:text-pretty`: both shrink the text block to even out
          line lengths, which reads as a wide right margin against a fixed
          `max-w-sm` column — measured 62px of dead space under `balance`, 16px
          under `pretty`, 5px with ordinary wrapping. Good for a headline, wrong
          for a paragraph in a narrow panel. */}
      <AlertDescription className="text-sm text-wrap md:text-wrap">
        {description}
      </AlertDescription>
      <div className="mt-3 flex gap-2">
        <Button variant="outline" size="sm" onClick={onReject}>
          {rejectLabel}
        </Button>
        <Button size="sm" onClick={onAccept}>
          {acceptLabel}
        </Button>
      </div>
    </Alert>
  );
}

/**
 * A link inside the banner's copy — the policy links the description sentence
 * wraps around. Pass the app's router link through `render`:
 * `<CookieBannerLink render={<Link href="/info/privacy" />}>`.
 *
 * It differs from the surrounding sentence by colour and underline and nothing
 * else. `Button`'s base sets `text-base font-strong`, which inside the
 * banner's `text-sm` body copy reads as a second typeface dropped mid-sentence,
 * so the font is inherited back — the same escape hatch the `bare` button
 * variant uses, and the reason this lives here rather than as a className at
 * the call site.
 */
export function CookieBannerLink({
  className,
  ...props
}: React.ComponentProps<typeof Button>) {
  return (
    <Button
      variant="link"
      size="inline"
      // It navigates, so it stays a link: base-ui would otherwise mark the
      // anchor up as a button and drop it from the screen reader's link list.
      nativeButton={false}
      role={undefined}
      className={cn('underline [font:inherit]', className)}
      {...props}
    />
  );
}
