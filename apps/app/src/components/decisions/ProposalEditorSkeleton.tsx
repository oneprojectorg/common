import { Skeleton } from '@op/ui/Skeleton';

/**
 * Skeleton for the proposal editor page.
 * Mirrors the layout of `ProposalEditorLayout` (topbar + content) and the
 * `ProposalEditor` form body so the swap to real content barely shifts.
 */
export function ProposalEditorSkeleton() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      {/* Topbar — mirrors ProposalEditorLayout */}
      <div className="flex h-editor-topbar items-center justify-between gap-2 border-b px-4 sm:grid sm:grid-cols-[1fr_auto_1fr] sm:px-6">
        {/* Back */}
        <div className="flex items-center gap-2">
          <Skeleton className="size-6 rounded sm:size-4" />
          <Skeleton className="hidden h-4 w-12 sm:block" />
        </div>
        {/* Title */}
        <div className="hidden sm:block">
          <Skeleton className="h-5 w-64" />
        </div>
        {/* Actions */}
        <div className="flex items-center justify-end gap-4">
          <Skeleton className="hidden h-8 w-20 rounded sm:block" />
          <Skeleton className="h-8 w-16 rounded" />
          <Skeleton className="h-8 w-28 rounded" />
          <Skeleton className="hidden size-8 rounded sm:block" />
          <Skeleton className="hidden size-8 rounded-full sm:block" />
        </div>
      </div>

      {/* Sticky toolbar — mirrors RichTextEditorToolbar */}
      <div className="border-b border-neutral-gray1 bg-white">
        <div className="flex h-12 items-center gap-2 px-4 sm:px-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="size-6 rounded" />
          ))}
        </div>
      </div>

      {/* Form body */}
      <div className="flex flex-1 flex-col gap-12 py-12">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-6">
          {/* Title field */}
          <div className="flex flex-col gap-2">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-10 w-full" />
          </div>

          {/* Category + budget row */}
          <div className="flex flex-col gap-6 sm:flex-row">
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-10 w-full" />
            </div>
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-10 w-full" />
            </div>
          </div>

          {/* Rich-text fields */}
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-2/3" />
              <Skeleton className="mt-1 h-40 w-full" />
            </div>
          ))}

          {/* Attachments section */}
          <div className="flex flex-col gap-3 border-t border-neutral-gray1 pt-8">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-24 w-full rounded-md" />
          </div>
        </div>
      </div>
    </div>
  );
}
