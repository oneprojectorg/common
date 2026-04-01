import { cn } from '../../lib/utils';

interface TextCounterProps {
  textLength: number;
  max: number;
  showCurrent?: boolean;
  highlightAtLimit?: boolean;
  className?: string;
}

export function TextCounter({
  textLength,
  max,
  showCurrent = false,
  highlightAtLimit = false,
  className,
}: TextCounterProps) {
  if (textLength === 0) {
    return null;
  }

  const countDown = max - textLength;

  return (
    <span
      className={cn(
        'text-sm text-neutral-gray4',
        (countDown < 0 || (highlightAtLimit && countDown === 0)) &&
          'text-functional-red',
        className,
      )}
    >
      {showCurrent ? `${textLength}/${max}` : countDown}
    </span>
  );
}
