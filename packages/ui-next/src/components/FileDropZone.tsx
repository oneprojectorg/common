'use client';

import { type DragEventHandler, type ReactNode, useRef, useState } from 'react';
import { LuFilePlus2 } from 'react-icons/lu';

import { cn } from '../lib/utils';

export interface FileDropZoneProps {
  /** MIME types to accept (e.g., ['application/pdf', 'image/*']). */
  acceptedFileTypes?: string[];
  /** Callback when files are selected via drop or file picker. */
  onSelectFiles: (files: File[]) => void;
  /** Main label content. */
  label?: ReactNode;
  /** Description text below the label. */
  description?: string;
  /** Disable interaction. */
  isDisabled?: boolean;
  /** Allow multi-select. @default true */
  allowsMultiple?: boolean;
  /** Class name for the outer container. */
  className?: string;
}

export function FileDropZone({
  acceptedFileTypes,
  onSelectFiles,
  label,
  description,
  isDisabled = false,
  allowsMultiple = true,
  className,
}: FileDropZoneProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isOver, setIsOver] = useState(false);

  const accept = acceptedFileTypes?.join(',');

  const filterByType = (files: File[]) => {
    if (!acceptedFileTypes) return files;
    return files.filter((f) =>
      acceptedFileTypes.some((t) => {
        if (t.endsWith('/*')) {
          return f.type.startsWith(t.slice(0, -1));
        }
        return f.type === t;
      }),
    );
  };

  const handleDrop: DragEventHandler<HTMLDivElement> = (e) => {
    e.preventDefault();
    setIsOver(false);
    if (isDisabled) return;
    const files = filterByType(Array.from(e.dataTransfer.files));
    if (files.length > 0) {
      onSelectFiles(allowsMultiple ? files : files.slice(0, 1));
    }
  };

  const handleSelect = (fileList: FileList | null) => {
    if (!fileList) return;
    onSelectFiles(Array.from(fileList));
  };

  return (
    <div
      data-drop-target={isOver || undefined}
      onDragOver={(e) => {
        e.preventDefault();
        if (!isDisabled) setIsOver(true);
      }}
      onDragLeave={() => setIsOver(false)}
      onDrop={handleDrop}
      className={cn('group/dropzone flex w-full', className)}
    >
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={isDisabled}
        className={cn(
          'border-input bg-muted/50 flex flex-1 cursor-pointer flex-col items-center justify-center gap-6 rounded-lg border border-dashed px-12 py-6 transition-colors duration-200 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
          'group-data-[drop-target]/dropzone:border-primary group-data-[drop-target]/dropzone:bg-primary/10',
          isDisabled && 'pointer-events-none cursor-not-allowed opacity-50',
        )}
      >
        <div className="bg-muted group-data-[drop-target]/dropzone:bg-primary/15 flex size-20 items-center justify-center rounded-full">
          <LuFilePlus2 className="text-muted-foreground group-data-[drop-target]/dropzone:text-primary size-10" />
        </div>
        <div className="flex flex-col items-center gap-1">
          <span className="text-foreground text-base">
            {label ?? (
              <>
                Drag a file here or{' '}
                <span className="text-primary hover:underline">browse</span>
              </>
            )}
          </span>
          {description && (
            <span className="text-muted-foreground text-base">
              {description}
            </span>
          )}
        </div>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={allowsMultiple}
        disabled={isDisabled}
        onChange={(e) => handleSelect(e.target.files)}
        className="hidden"
      />
    </div>
  );
}
