/** Renders title + description header for a form field. */
export function FieldHeader({
  title,
  description,
  className = 'gap-2',
}: {
  title?: string;
  description?: string;
  className?: string;
}) {
  if (!title && !description) {
    return null;
  }

  return (
    <div className={`flex flex-col ${className}`}>
      {title && (
        <span className="font-serif text-title-sm14 text-neutral-charcoal">
          {title}
        </span>
      )}
      {description && (
        <p className="text-sm text-neutral-charcoal">{description}</p>
      )}
    </div>
  );
}
