'use client';

import { Button } from '@op/sense/Button';
import { Calendar } from '@op/sense/Calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@op/sense/Popover';
import { cn } from '@op/sense/lib/utils';
import { useId, useState } from 'react';
import { LuCalendar } from 'react-icons/lu';

/**
 * PROTOTYPE ONLY — delete with the rest of `components/prototype`.
 *
 * A phase's window as one control. `@op/sense/DatePicker` is single-date only,
 * so this is `DatePickerButton`'s trigger over a range calendar: the same
 * outline button, the same leading calendar glyph, the same muted placeholder,
 * so it reads as the product's date field rather than as a new control.
 *
 * A phase runs between two dates, and asking for them separately made the pair
 * look like two independent settings — which is how a start ends up after an
 * end. Two months are shown at once because a window usually crosses one. A
 * results phase is the exception: it doesn't run for a while, it happens on a
 * day, so `single` collapses the same control to one date.
 *
 * No visible label. The card it sits in is titled with the window it sets, and
 * a second heading saying the same thing twice was two labels for one control —
 * so the name goes to the button itself, where anything that can't see the card
 * heading will still find it.
 */
export function PrototypeDateRangeField({
  label,
  start,
  end,
  single = false,
  taken,
  placeholder = 'Pick a date',
  onChange,
}: {
  /** The control's accessible name — the card's own title. */
  label: string;
  start?: Date;
  end?: Date;
  /** One date rather than a window. */
  single?: boolean;
  /**
   * Windows that belong to earlier phases, which this one cannot be given.
   * Phases run one after another, so a date another phase is already using is
   * not a choice — offering it and then quietly reflowing the schedule around it
   * would be worse than not offering it at all.
   */
  taken?: { from: Date; to: Date }[];
  placeholder?: string;
  onChange: (range: { start?: Date; end?: Date }) => void;
}) {
  const id = useId();
  const [isOpen, setIsOpen] = useState(false);
  const only = single ? (end ?? start) : undefined;
  /* The day after the last one an earlier phase has claimed: where an unset
     window would begin. */
  const firstFree = taken?.length
    ? new Date(
        Math.max(...taken.map((window) => window.to.getTime())) + 86_400_000,
      )
    : undefined;

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger
        render={
          <Button
            id={id}
            variant="outline"
            aria-label={label}
            className={cn(
              'w-full justify-start font-normal',
              !start && !end && 'text-muted-foreground',
            )}
          />
        }
      >
        <LuCalendar />
        {start || end ? (
          single ? (
            formatDay(only)
          ) : (
            formatRange(start, end)
          )
        ) : (
          <span>{placeholder}</span>
        )}
      </PopoverTrigger>
      {/* Portaled outside the `.sense` scope — re-scope so sense tokens
          apply, exactly as `DatePicker` does. */}
      <PopoverContent align="start" className="sense w-auto p-0">
        {single ? (
          <Calendar
            mode="single"
            selected={only}
            defaultMonth={only ?? firstFree}
            // `{ from, to }` is a range matcher, which is what these are.
            disabled={taken?.length ? taken : undefined}
            onSelect={(date) => onChange({ start: date, end: date })}
          />
        ) : (
          <Calendar
            mode="range"
            numberOfMonths={2}
            selected={{ from: start, to: end }}
            /* Opens where there is room, not on a month made entirely of dates
               you cannot pick. */
            defaultMonth={start ?? firstFree}
            disabled={taken?.length ? taken : undefined}
            onSelect={(range) =>
              onChange({ start: range?.from, end: range?.to })
            }
          />
        )}
      </PopoverContent>
    </Popover>
  );
}

/** "Apr 28, 2026". */
function formatDay(date?: Date): string {
  return date
    ? date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : '';
}

/** "Feb 10 – Mar 2, 2026", collapsing whatever the two dates share. */
function formatRange(start?: Date, end?: Date): string {
  if (start && end) {
    const sameYear = start.getFullYear() === end.getFullYear();

    return `${start.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      ...(sameYear ? {} : { year: 'numeric' }),
    })} – ${end.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })}`;
  }

  const only = start ?? end;

  if (!only) {
    return '';
  }

  // One end picked: say which one, so a half-set window doesn't read as a day.
  return `${start ? 'From' : 'Until'} ${only.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })}`;
}
