'use client';

import type { ReactNode } from 'react';
import type { DropEvent } from 'react-aria';
import {
  Button,
  DropZone,
  FileTrigger,
  Text,
  isFileDropItem,
} from 'react-aria-components';
import { LuFilePlus2 } from 'react-icons/lu';
import { tv } from 'tailwind-variants';

export interface FileDropZoneProps {
  /**
   * MIME types to accept (e.g., ['application/pdf', 'image/*']).
   * When undefined, accepts all files.
   */
  acceptedFileTypes?: string[];

  /** Callback when files are selected via drop or file picker. */
  onSelectFiles: (files: File[]) => void;

  /** Main label content. */
  label?: ReactNode;

  /** Description text shown below the label (e.g., accepted formats, size limits). */
  description?: string;

  /** Whether the drop zone is disabled. */
  isDisabled?: boolean;

  /**
   * Whether to allow selecting multiple files.
   * @default true
   */
  allowsMultiple?: boolean;

  /** Additional class name for the outer container. */
  className?: string;
}

const dropZoneStyles = tv({
  slots: {
    root: 'group/dropzone flex w-full',
    button: [
      'flex flex-1 cursor-pointer flex-col items-center justify-center gap-6',
      'rounded-lg border border-dashed border-input bg-muted',
      'px-12 py-6',
      'outline-hidden transition-colors duration-200',
      'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
      'group-data-[drop-target]/dropzone:bg-primary/10/30 group-data-[drop-target]/dropzone:border-primary',
    ],
    iconWrapper: [
      'flex size-20 items-center justify-center rounded-full bg-accent',
      'group-data-[drop-target]/dropzone:bg-primary/20',
    ],
    icon: [
      'size-10 text-muted-foreground',
      'group-data-[drop-target]/dropzone:text-primary',
    ],
    labelWrapper: 'flex flex-col items-center gap-1',
    label: 'text-base text-foreground',
    browse: 'text-primary hover:text-primary hover:underline',
    description: 'text-base text-muted-foreground',
  },
  variants: {
    isDisabled: {
      true: {
        button: 'pointer-events-none cursor-not-allowed opacity-50',
      },
    },
  },
});

/**
 * A file upload zone where users can drop files or click to browse.
 */
export function FileDropZone(props: FileDropZoneProps) {
  const {
    acceptedFileTypes,
    onSelectFiles,
    label,
    description,
    isDisabled = false,
    allowsMultiple = true,
    className,
  } = props;

  const styles = dropZoneStyles({ isDisabled });

  const handleDrop = async (event: DropEvent) => {
    const fileItems = event.items.filter(isFileDropItem);
    const files = await Promise.all(fileItems.map((item) => item.getFile()));
    if (files.length > 0) {
      onSelectFiles(allowsMultiple ? files : files.slice(0, 1));
    }
  };

  const handleSelect = (fileList: FileList | null) => {
    if (!fileList) {
      return;
    }
    onSelectFiles(Array.from(fileList));
  };

  return (
    <DropZone
      className={styles.root({ className })}
      getDropOperation={(types) => {
        if (!acceptedFileTypes) {
          return 'copy';
        }
        return acceptedFileTypes.some((type) => types.has(type))
          ? 'copy'
          : 'cancel';
      }}
      onDrop={handleDrop}
      isDisabled={isDisabled}
    >
      <FileTrigger
        allowsMultiple={allowsMultiple}
        acceptedFileTypes={acceptedFileTypes}
        onSelect={handleSelect}
      >
        <Button className={styles.button()} isDisabled={isDisabled}>
          <div className={styles.iconWrapper()}>
            <LuFilePlus2 className={styles.icon()} />
          </div>
          <div className={styles.labelWrapper()}>
            <Text slot="label" className={styles.label()}>
              {label ?? (
                <>
                  Drag a file here or{' '}
                  <span className={styles.browse()}>browse</span>
                </>
              )}
            </Text>
            {description && (
              <Text className={styles.description()}>{description}</Text>
            )}
          </div>
        </Button>
      </FileTrigger>
    </DropZone>
  );
}
