import { Input as InputPrimitive } from '@base-ui/react/input';
import * as React from 'react';

import { cn } from '../../lib/utils';

// Constrained types (email/url/number/etc) are always latin → force LTR.
// Free text uses `unicode-bidi: plaintext` rather than `dir="auto"`: auto
// resolves an empty input to LTR (ignoring the placeholder), which left-aligns
// RTL placeholders; plaintext lets an empty field inherit the locale direction
// and a filled one follow its own content.
//
// An explicit `dir` always wins: plaintext resolves direction per paragraph and
// would otherwise override the direction the caller asked for.
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
  ...props
}: React.ComponentProps<'input'>) {
  const isAlwaysLTR = CONSTRAINED_INPUT_TYPES.has(type ?? '');

  return (
    <InputPrimitive
      type={type}
      dir={dir ?? (isAlwaysLTR ? 'ltr' : undefined)}
      data-slot="input"
      className={cn(
        !isAlwaysLTR && !dir && '[unicode-bidi:plaintext]',
        'h-11 w-full min-w-0 rounded-lg border border-input bg-background px-3 py-1 text-base transition-colors outline-none file:inline-flex file:h-8 file:border-0 file:bg-transparent file:text-base file:font-strong file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&[type=file]]:text-muted-foreground',
        className,
      )}
      {...props}
    />
  );
}

export { Input };
