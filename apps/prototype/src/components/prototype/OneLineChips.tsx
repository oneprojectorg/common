'use client';

import { Badge } from '@op/sense/Badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@op/sense/Tooltip';
import { cn } from '@op/sense/lib/utils';
import { useLayoutEffect, useRef, useState } from 'react';

/** `gap-1`, as a number, because the fit is arithmetic rather than layout. */
const CHIP_GAP = 4;

/**
 * PROTOTYPE ONLY — delete with the rest of `components/prototype`.
 *
 * A set of labels as chips on one line, with the rest counted in a trailing
 * `+ n more` that names them on hover.
 *
 * How many fit is measured rather than fixed. A count picked in advance either
 * truncates long names — and a label you can't read is no evidence of what the
 * labels are — or wastes the line on short ones. So the first paint renders
 * every chip, clipped, which is the one chance to read their natural widths;
 * from those the row keeps whatever fits whole, leaving room for the count chip
 * when there is anything left to count. A resize re-runs the sum against the
 * widths already measured.
 */
export function OneLineChips({
  labels,
  variant = 'outline',
  className,
}: {
  labels: string[];
  variant?: 'outline' | 'secondary';
  className?: string;
}) {
  const rowRef = useRef<HTMLSpanElement>(null);
  /** Natural chip widths, labels first and the count chip last. */
  const natural = useRef<number[] | null>(null);
  // `null` is the measuring pass: everything rendered, nothing counted yet.
  const [visible, setVisible] = useState<number | null>(null);

  useLayoutEffect(() => {
    const row = rowRef.current;

    if (!row) {
      return;
    }

    const fit = () => {
      if (!natural.current) {
        natural.current = Array.from(row.children).map(
          (chip) => (chip as HTMLElement).offsetWidth,
        );
      }

      const widths = natural.current;
      const countChip = widths[widths.length - 1] ?? 0;
      const available = row.clientWidth;
      let used = 0;
      let fits = 0;

      for (let index = 0; index < labels.length; index += 1) {
        const width = widths[index] ?? 0;
        const next = used + (fits > 0 ? CHIP_GAP : 0) + width;
        // Whatever is left has to be countable, so the count chip needs room —
        // unless this is the last one, in which case there is nothing to count.
        const tail = index < labels.length - 1 ? CHIP_GAP + countChip : 0;

        if (next + tail > available) {
          break;
        }

        used = next;
        fits += 1;
      }

      // Never nothing: one clipped chip still says what kind of thing these are.
      setVisible(Math.max(1, fits));
    };

    fit();

    const observer = new ResizeObserver(fit);

    observer.observe(row);

    return () => observer.disconnect();
  }, [labels]);

  const shown = visible === null ? labels : labels.slice(0, visible);
  const hidden = labels.slice(shown.length);

  return (
    <span
      ref={rowRef}
      className={cn('flex min-w-0 gap-1 overflow-hidden', className)}
      // The measuring pass is one paint with every chip in it; announcing the
      // clipped set would be announcing a state nobody sees.
      aria-live="off"
    >
      {shown.map((label) => (
        <Badge key={label} variant={variant} className="font-normal">
          {label}
        </Badge>
      ))}
      {/* Rendered during the measuring pass too, so its width is known before
          it is needed. The names are on it rather than merely counted: a
          number tells you something is missing without telling you what. */}
      {hidden.length > 0 || visible === null ? (
        <Tooltip>
          <TooltipTrigger render={<span className="flex shrink-0" />}>
            <Badge variant={variant} className="font-normal">
              + {hidden.length || labels.length} more
            </Badge>
            <span className="sr-only">
              {(hidden.length ? hidden : labels).join(', ')}
            </span>
          </TooltipTrigger>
          <TooltipContent>
            {(hidden.length ? hidden : labels).join(' · ')}
          </TooltipContent>
        </Tooltip>
      ) : null}
    </span>
  );
}
