export function RichTextEditorSkeleton({
  className = '',
}: {
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="space-y-4 animate-pulse">
        {/* Title/heading line */}
        <div className="h-8 w-3/4 rounded bg-neutral-gray1" />

        {/* Paragraph lines */}
        <div className="space-y-3">
          <div className="h-4 w-full rounded bg-neutral-gray1" />
          <div className="h-4 w-5/6 rounded bg-neutral-gray1" />
          <div className="h-4 w-4/5 rounded bg-neutral-gray1" />
        </div>

        {/* Another paragraph */}
        <div className="space-y-3">
          <div className="h-4 w-full rounded bg-neutral-gray1" />
          <div className="h-4 w-11/12 rounded bg-neutral-gray1" />
          <div className="h-4 w-3/4 rounded bg-neutral-gray1" />
          <div className="h-4 w-5/6 rounded bg-neutral-gray1" />
        </div>

        {/* Short line */}
        <div className="h-4 w-2/3 rounded bg-neutral-gray1" />
      </div>
    </div>
  );
}
