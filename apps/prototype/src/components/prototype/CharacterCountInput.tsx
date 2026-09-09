'use client';

import { FieldError } from '@op/sense/Field';
import { Input } from '@op/sense/Input';
import { cn } from '@op/sense/lib/utils';
import { type ComponentProps, useEffect, useId, useState } from 'react';

/**
 * PROTOTYPE ONLY — delete with the rest of `components/prototype`.
 *
 * A capped field that stays quiet until the cap is nearly in play, and then
 * refuses to hide the problem rather than solving it for you.
 *
 * Three deliberate departures from [`CountedInput`](./CountedInput.tsx), which
 * caps a process name and is left alone:
 *
 * 1. **The count is hidden until it matters, and so is its space.** A counter
 *    sitting at `0/250` under an empty field is a warning about a limit nobody
 *    is near, and it reads as an instruction to fill the space. It fades in
 *    within `revealWithin` of the limit — the field's end padding opening for it
 *    in the same motion — and both go back when you delete under the threshold.
 * 2. **The limit does not stop you typing, and never truncates a paste.**
 *    Silently dropping the end of what someone pasted loses their work without
 *    telling them; going over and being told is recoverable. This is why there
 *    is no `maxLength` here.
 * 3. **Over the limit is an error state, not a full field.** The border, the
 *    count and a sentence naming the field all turn, and the page that owns the
 *    save is expected to refuse to commit — see `isPhaseOverLimit` in
 *    `store.ts`, which is the shared rule rather than a second opinion.
 *
 * Announcement follows GOV.UK's character count rather than the shape of the
 * markup: the digits are `aria-hidden`, and a separate polite region carries
 * "37 characters remaining" a second after typing stops. Putting `aria-live` on
 * the digits themselves — which is what this component replaced — announces
 * every keystroke, so the count is read aloud instead of the words being typed.
 */
export function CharacterCountInput({
  value,
  limit,
  fieldLabel,
  revealWithin = 20,
  className,
  ...props
}: Omit<ComponentProps<typeof Input>, 'value' | 'maxLength'> & {
  value: string;
  limit: number;
  /**
   * Names the field in the error, so the sentence stands on its own when it is
   * the only thing a screen reader reads: "Field name must be 120 characters or
   * less", not "Must be 120 characters or less".
   */
  fieldLabel: string;
  /** How close to the limit the count appears. */
  revealWithin?: number;
}) {
  const errorId = useId();
  const count = value.length;
  const isOver = count > limit;
  /* One condition, not a latch: "stays visible until it drops back below the
     threshold" is the same thing as being at or over it. */
  const showCount = count >= limit - revealWithin;

  const announcement = useAnnouncement({ count, limit, showCount });

  return (
    <>
      <div className="relative">
        <Input
          value={value}
          aria-invalid={isOver || undefined}
          aria-describedby={isOver ? errorId : undefined}
          /* Room for the count is made only when there is a count to make room
             for: reserving it permanently narrowed every one of these fields for
             a limit almost none of them are near. It stays reserved for as long
             as the count is up, the error state included, and goes back when the
             count does.

             The transition has to name the colour properties too. `Input`'s own
             `transition-colors` sets `transition-property`, and so does this —
             `cn()` resolves that conflict to whichever comes last, so listing
             only the padding here would have quietly dropped the border's fade
             into the error state. */
          className={cn(
            'transition-[padding-inline-end,color,background-color,border-color,outline-color,box-shadow] duration-[160ms] ease-out motion-reduce:transition-none',
            showCount && 'pe-19',
            className,
          )}
          {...props}
        />
        {/* Mounted whether or not it shows, because it fades: a node that only
            exists once it is wanted has nothing to fade from. `aria-hidden`
            either way — the words for this go through the live region below. */}
        <span
          aria-hidden
          className={cn(
            'pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-sm tabular-nums transition-[opacity,color] duration-[160ms] ease-out motion-reduce:transition-none',
            showCount ? 'opacity-100' : 'opacity-0',
            isOver ? 'text-destructive' : 'text-muted-foreground',
          )}
        >
          {count}/{limit}
        </span>
      </div>
      {/* Outside the positioned box, so the count keeps centring on the control
          rather than on the control plus a sentence. */}
      <span aria-live="polite" className="sr-only">
        {announcement}
      </span>
      {isOver ? (
        <FieldError id={errorId}>
          {fieldLabel} must be {limit} characters or less
        </FieldError>
      ) : null}
    </>
  );
}

/**
 * The polite announcement, held back a second after the last keystroke.
 *
 * Empty until the count is showing, so nothing is said about a limit that is
 * not yet in play — and cleared on the way back down, so a stale "3 characters
 * remaining" isn't left sitting in the live region.
 */
function useAnnouncement({
  count,
  limit,
  showCount,
}: {
  count: number;
  limit: number;
  showCount: boolean;
}) {
  const [announcement, setAnnouncement] = useState('');

  useEffect(() => {
    if (!showCount) {
      setAnnouncement('');

      return;
    }

    const over = count - limit;
    const timer = setTimeout(() => {
      setAnnouncement(
        over > 0
          ? `${over} character${over === 1 ? '' : 's'} too many`
          : `${-over} character${over === -1 ? '' : 's'} remaining`,
      );
    }, 1000);

    return () => clearTimeout(timer);
  }, [count, limit, showCount]);

  return announcement;
}
