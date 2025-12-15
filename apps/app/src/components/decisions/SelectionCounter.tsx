'use client';

interface SelectionCounterProps {
  selectedCount: number;
  maxVotes: number;
  className?: string;
}

export function SelectionCounter({
  selectedCount,
  maxVotes,
  className = '',
}: SelectionCounterProps) {
  const isAtLimit = selectedCount === maxVotes;
  const hasSelection = selectedCount > 0;

  return (
    <div className={`${className} flex items-center justify-center p-3`}>
      <div className="flex items-center gap-2">
        <div
          className={`h-3 w-3 rounded-full transition-colors ${
            hasSelection ? 'bg-primary-teal' : 'bg-neutral-gray2'
          }`}
        />
        <span
          className={`font-medium transition-colors ${
            isAtLimit
              ? 'text-amber-600'
              : hasSelection
                ? 'text-primary-teal'
                : 'text-neutral-charcoal'
          }`}
        >
          {selectedCount} of {maxVotes} proposal{maxVotes === 1 ? '' : 's'}{' '}
          selected
        </span>
        {isAtLimit && (
          <span className="rounded bg-amber-50 px-2 py-1 text-xs text-amber-600">
            Limit reached
          </span>
        )}
      </div>
    </div>
  );
}
