import { Header4 } from '@op/ui/Header';

/** Renders title + description header for a form field. */
export function FieldHeader({
  title,
  description,
  badge,
  required,
  className = 'gap-2',
}: {
  title?: string;
  description?: string;
  /** Optional trailing element shown inline with the title (e.g. "5 pts", "Yes/No"). */
  badge?: React.ReactNode;
  /** When true, renders a red asterisk next to the title. */
  required?: boolean;
  className?: string;
}) {
  if (!title && !description) {
    return null;
  }

  const titleContent = title ? (
    required ? (
      <>
        {title}
        <span className="text-functional-red" aria-hidden="true">
          {' '}
          *
        </span>
      </>
    ) : (
      title
    )
  ) : undefined;

  return (
    <div className={`flex flex-col ${className}`}>
      {titleContent &&
        (badge ? (
          <div className="flex items-baseline justify-between gap-2">
            <Header4 className="font-light">{titleContent}</Header4>
            <span className="shrink-0 text-xs text-neutral-gray4">{badge}</span>
          </div>
        ) : (
          <Header4 className="font-light">{titleContent}</Header4>
        ))}
      {description && (
        <p className="text-sm text-neutral-charcoal">{description}</p>
      )}
    </div>
  );
}
