import * as React from 'react';

import { firstStrongDirection } from '../../lib/textDirection';
import { useFieldSizingFallback } from '../../lib/useFieldSizingFallback';
import { cn } from '../../lib/utils';

function Textarea({
  className,
  dir,
  value,
  ref,
  unstyled = false,
  ...props
}: React.ComponentProps<'textarea'> & {
  /** No chrome, no resize grip and no type size: the field keeps its behaviour and takes the type around it. */
  unstyled?: boolean;
}) {
  const isControlled = value != null;
  // One direction for the whole box, from the value. `dir="auto"` would not do:
  // the UA stylesheet gives `textarea[dir=auto]` `unicode-bidi: plaintext`, so
  // direction stays per-line and a blank line still resolves LTR — see
  // `lib/textDirection`. Prose keeps per-line resolution on purpose, where
  // mixed-language paragraphs are the point (`RichTextEditor/viewerStyles`).
  const resolvedDir = dir ?? firstStrongDirection(value) ?? undefined;
  const fieldRef = useFieldSizingFallback(ref, value);

  return (
    <textarea
      ref={fieldRef}
      dir={resolvedDir}
      value={value}
      data-slot="textarea"
      className={cn(
        // Uncontrolled only — see `Input` for why this can't cover an empty
        // control that has no placeholder.
        !resolvedDir &&
          !isControlled &&
          '[unicode-bidi:plaintext] placeholder-shown:[unicode-bidi:normal]',
        'flex field-sizing-content w-full outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50',
        unstyled
          ? 'resize-none'
          : 'min-h-16 rounded-lg border border-input bg-background px-3 py-2 text-base transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:bg-muted aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40',
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
