/** Renders title + description header for a form field. */
export function FieldHeader({
  title,
  description,
  badge,
  className = 'gap-2',
}: {
  title?: string;
  description?: string;
  /** Optional trailing element shown inline with the title (e.g. "5 pts", "Yes/No"). */
  badge?: React.ReactNode;
  className?: string;
}) {
  if (!title && !description) {
    return null;
  }

  return (
    <div className={`flex flex-col ${className}`}>
      {title &&
        (badge ? (
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-serif text-title-sm14 text-neutral-charcoal">
              {title}
            </span>
            <span className="shrink-0 text-xs text-neutral-gray4">{badge}</span>
          </div>
        ) : (
          <span className="font-serif text-title-sm14 text-neutral-charcoal">
            {title}
          </span>
        ))}
      {description && (
        <p className="text-sm text-neutral-charcoal">{description}</p>
      )}
    </div>
  );
}
