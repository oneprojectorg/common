import * as React from 'react';

import { cn } from '../../lib/utils';

function Textarea({
  className,
  dir,
  value,
  ...props
}: React.ComponentProps<'textarea'>) {
  // Whole-box direction from the value, not `unicode-bidi: plaintext`, once
  // there is a value to read: plaintext resolves per line, and a blank line has
  // no strong character, so UAX9 P3 makes it LTR — which parked the caret on
  // the wrong side of every empty line in an otherwise Arabic box. These are
  // single-value fields where one language per box is the norm, so one
  // direction for all of them beats per-line accuracy. (Prose keeps per-line
  // resolution: see `RichTextEditor/viewerStyles`.)
  //
  // While empty, direction comes from the locale instead — `dir="auto"` would
  // resolve LTR with nothing to read and left-align an RTL placeholder, and
  // being an attribute it can't be switched back off in CSS the way the
  // plaintext class can.
  const resolvedDir =
    dir ?? (typeof value === 'string' && value.length > 0 ? 'auto' : undefined);

  return (
    <textarea
      dir={resolvedDir}
      value={value}
      data-slot="textarea"
      className={cn(
        !resolvedDir &&
          '[unicode-bidi:plaintext] placeholder-shown:[unicode-bidi:normal]',
        'flex field-sizing-content min-h-16 w-full rounded-lg border border-input bg-background px-3 py-2 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40',
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
