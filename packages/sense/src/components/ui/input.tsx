import { Input as InputPrimitive } from '@base-ui/react/input';
import * as React from 'react';

import { firstStrongDirection } from '../../lib/textDirection';
import { cn } from '../../lib/utils';

// Constrained types are always latin, whatever the reader's locale.
const CONSTRAINED_INPUT_TYPES = new Set([
  'email',
  'tel',
  'url',
  'number',
  'password',
]);

function Input({
  className,
  type,
  dir,
  value,
  unstyled = false,
  ...props
}: React.ComponentProps<'input'> & {
  /** No chrome and no type size: the field keeps its behaviour and takes the type around it. */
  unstyled?: boolean;
}) {
  const isControlled = value != null;
  const resolvedDir =
    dir ??
    (CONSTRAINED_INPUT_TYPES.has(type ?? '')
      ? 'ltr'
      : (firstStrongDirection(value) ?? undefined));

  return (
    <InputPrimitive
      type={type}
      // Direction comes from the value, so it survives a blank field and a
      // value of only spaces or digits — both of which have no strong character
      // and therefore inherit the page instead of being forced one way.
      dir={resolvedDir}
      value={value}
      data-slot="input"
      className={cn(
        // Uncontrolled only: nothing can read the value, so fall back to CSS.
        // `plaintext` follows UAX9 P2/P3, and P3 resolves a run with no strong
        // character to LTR rather than to the inherited direction — hence the
        // `placeholder-shown` escape, which only fires on a control that has a
        // placeholder to show.
        !resolvedDir &&
          !isControlled &&
          '[unicode-bidi:plaintext] placeholder-shown:[unicode-bidi:normal]',
        'w-full min-w-0 outline-none file:inline-flex file:h-8 file:border-0 file:bg-transparent file:text-base file:font-strong file:text-foreground placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 [&[type=file]]:text-muted-foreground',
        !unstyled &&
          'h-11 rounded-lg border border-input bg-background px-3 py-1 text-base transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:bg-muted aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40',
        className,
      )}
      {...props}
    />
  );
}

export { Input };
