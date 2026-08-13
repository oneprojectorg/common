'use client';

import * as React from 'react';
import { LuFilePlus2 } from 'react-icons/lu';

import { cn } from '../../lib/utils';

interface FileDropZoneProps {
  /**
   * MIME types to accept (e.g., ['application/pdf', 'image/*']).
   * When undefined, accepts all files.
   */
  acceptedFileTypes?: string[];
  /** Callback when files are selected via drop or file picker. */
  onSelectFiles: (files: File[]) => void;
  /** Main label content. */
  label?: React.ReactNode;
  /** Description text shown below the label (e.g., accepted formats, size limits). */
  description?: string;
  disabled?: boolean;
  /**
   * Whether to allow selecting multiple files.
   * @default true
   */
  allowsMultiple?: boolean;
  className?: string;
}

/**
 * A file upload zone where users can drop files or click to browse.
 * Native drag events — no drag-and-drop library.
 */
function FileDropZone({
  acceptedFileTypes,
  onSelectFiles,
  label,
  description,
  disabled = false,
  allowsMultiple = true,
  className,
}: FileDropZoneProps) {
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const [isDropTarget, setIsDropTarget] = React.useState(false);

  const acceptsType = (type: string) => {
    if (!acceptedFileTypes) {
      return true;
    }
    return acceptedFileTypes.some((accepted) =>
      accepted.endsWith('/*')
        ? type.startsWith(accepted.slice(0, -1))
        : type === accepted,
    );
  };

  const acceptsFile = (file: File) => acceptsType(file.type);

  // Only light up (and allow a drop) for drags that carry at least one
  // acceptable file — otherwise text/link drags and wrong-type files get an
  // accepting cursor whose drop would be silently discarded. Some browsers
  // report an empty type during dragover; treat that as unknown-but-allowed.
  const dragHasAcceptableFile = (dataTransfer: DataTransfer) =>
    Array.from(dataTransfer.items).some(
      (item) =>
        item.kind === 'file' && (item.type === '' || acceptsType(item.type)),
    );

  const emitFiles = (files: File[]) => {
    const accepted = files.filter(acceptsFile);
    if (accepted.length > 0) {
      onSelectFiles(allowsMultiple ? accepted : accepted.slice(0, 1));
    }
  };

  return (
    <div
      data-slot="file-drop-zone"
      data-drop-target={isDropTarget || undefined}
      className={cn('group/dropzone flex w-full', className)}
      onDragOver={(event) => {
        if (disabled || !dragHasAcceptableFile(event.dataTransfer)) {
          return;
        }
        event.preventDefault();
        setIsDropTarget(true);
      }}
      onDragLeave={(event) => {
        const related = event.relatedTarget;
        if (
          !(related instanceof Node) ||
          !event.currentTarget.contains(related)
        ) {
          setIsDropTarget(false);
        }
      }}
      onDrop={(event) => {
        event.preventDefault();
        setIsDropTarget(false);
        if (!disabled) {
          emitFiles(Array.from(event.dataTransfer.files));
        }
      }}
    >
      <button
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        className={cn(
          'flex flex-1 cursor-pointer flex-col items-center justify-center gap-6 rounded-lg border border-dashed border-input bg-muted px-12 py-6 transition-colors duration-200 outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2',
          'group-data-[drop-target]/dropzone:border-primary group-data-[drop-target]/dropzone:bg-accent/50',
          disabled && 'pointer-events-none cursor-not-allowed opacity-50',
        )}
      >
        <div className="flex size-20 items-center justify-center rounded-full bg-background group-data-[drop-target]/dropzone:bg-accent">
          <LuFilePlus2 className="size-10 stroke-1! text-muted-foreground group-data-[drop-target]/dropzone:text-accent-foreground" />
        </div>
        <div className="flex flex-col items-center gap-1">
          <span className="text-base">
            {label ?? (
              <>
                Drag a file here or{' '}
                <span className="text-primary hover:underline">browse</span>
              </>
            )}
          </span>
          {description && (
            <span className="text-base text-muted-foreground">
              {description}
            </span>
          )}
        </div>
      </button>
      <input
        ref={inputRef}
        type="file"
        multiple={allowsMultiple}
        accept={acceptedFileTypes?.join(',')}
        className="hidden"
        onChange={(event) => {
          emitFiles(Array.from(event.target.files ?? []));
          event.target.value = '';
        }}
      />
    </div>
  );
}

export { FileDropZone };
