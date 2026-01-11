export function RichTextEditorSkeleton({
  className = '',
}: {
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="animate-pulse space-y-4">
        {/* Title/heading line */}
        <div className="bg-neutral-gray1 h-8 w-3/4 rounded" />

        {/* Paragraph lines */}
        <div className="space-y-3">
          <div className="bg-neutral-gray1 h-4 w-full rounded" />
          <div className="bg-neutral-gray1 h-4 w-5/6 rounded" />
          <div className="bg-neutral-gray1 h-4 w-4/5 rounded" />
        </div>

        {/* Another paragraph */}
        <div className="space-y-3">
          <div className="bg-neutral-gray1 h-4 w-full rounded" />
          <div className="bg-neutral-gray1 h-4 w-11/12 rounded" />
          <div className="bg-neutral-gray1 h-4 w-3/4 rounded" />
          <div className="bg-neutral-gray1 h-4 w-5/6 rounded" />
        </div>

        {/* Short line */}
        <div className="bg-neutral-gray1 h-4 w-2/3 rounded" />
      </div>
    </div>
  );
}
