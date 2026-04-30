export function RichTextEditorSkeleton({
  className = '',
}: {
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="animate-pulse space-y-4">
        {/* Title/heading line */}
        <div className="h-8 w-3/4 rounded bg-accent" />

        {/* Paragraph lines */}
        <div className="space-y-3">
          <div className="h-4 w-full rounded bg-accent" />
          <div className="h-4 w-5/6 rounded bg-accent" />
          <div className="h-4 w-4/5 rounded bg-accent" />
        </div>

        {/* Another paragraph */}
        <div className="space-y-3">
          <div className="h-4 w-full rounded bg-accent" />
          <div className="h-4 w-11/12 rounded bg-accent" />
          <div className="h-4 w-3/4 rounded bg-accent" />
          <div className="h-4 w-5/6 rounded bg-accent" />
        </div>

        {/* Short line */}
        <div className="h-4 w-2/3 rounded bg-accent" />
      </div>
    </div>
  );
}
