import { Skeleton } from '../ui/skeleton';

export function RichTextEditorSkeleton({
  className = '',
}: {
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="space-y-4">
        {/* Title/heading line */}
        <Skeleton className="h-8 w-3/4" />

        {/* Paragraph lines */}
        <div className="space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-4/5" />
        </div>

        {/* Another paragraph */}
        <div className="space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-11/12" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-5/6" />
        </div>

        {/* Short line */}
        <Skeleton className="h-4 w-2/3" />
      </div>
    </div>
  );
}
