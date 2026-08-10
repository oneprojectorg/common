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
  ...props
}: React.ComponentProps<'input'>) {
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
        'h-11 w-full min-w-0 rounded-lg border border-input bg-background px-3 py-1 text-base transition-colors outline-none file:inline-flex file:h-8 file:border-0 file:bg-transparent file:text-base file:font-strong file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&[type=file]]:text-muted-foreground',
        className,
      )}
      {...props}
    />
  );
}

export { Input };
