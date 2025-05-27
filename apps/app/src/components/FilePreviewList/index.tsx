import type { FilePreview } from '@/hooks/useFileUpload';
import { LoadingSpinner } from '@op/ui/LoadingSpinner';
import { cn } from '@op/ui/utils';
import { LuFile, LuX } from 'react-icons/lu';

interface FilePreviewListProps {
  files: FilePreview[];
  onRemove: (id: string) => void;
  className?: string;
}

export const FilePreviewList = ({
  files,
  onRemove,
  className,
}: FilePreviewListProps) => {
  if (files.length === 0) return null;

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {files.map((filePreview) => (
        <div
          key={filePreview.id}
          className={cn(
            'flex items-center gap-3 rounded border p-2',
            filePreview.error
              ? 'border-red-200 bg-red-50'
              : 'border-gray-200 bg-gray-50',
          )}
        >
          {/* File Icon/Preview */}
          <div className="flex-shrink-0">
            {filePreview.mimeType.startsWith('image/') ? (
              <div className="size-8 overflow-hidden rounded bg-gray-200">
                <img
                  src={filePreview.url}
                  alt={filePreview.fileName}
                  className="size-full object-cover"
                />
              </div>
            ) : (
              <div className="flex size-8 items-center justify-center rounded bg-gray-200">
                <LuFile className="size-4" />
              </div>
            )}
          </div>

          {/* File Info */}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">
              {filePreview.fileName}
            </p>
            <p className="text-xs text-gray-500">
              {(filePreview.fileSize / 1024 / 1024).toFixed(2)} MB
            </p>
            {filePreview.error && (
              <p className="text-xs text-red-500">{filePreview.error}</p>
            )}
          </div>

          {/* Status/Actions */}
          <div className="flex flex-shrink-0 items-center gap-2">
            {filePreview.uploading && <LoadingSpinner className="size-4" />}
            {filePreview.uploaded && (
              <div className="flex size-4 items-center justify-center rounded-full bg-green-500">
                <div className="size-2 rounded-full bg-white"></div>
              </div>
            )}
            <button
              onClick={() => onRemove(filePreview.id)}
              className="rounded p-1 hover:bg-gray-200"
              disabled={filePreview.uploading}
            >
              <LuX className="size-3" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};
