'use client';

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
   * MIME types or extensions to accept (e.g., ['image/*', '.pdf']).
   * When undefined, accepts all files.
   */
  acceptedFileTypes?: string[];

  /** Callback when files are selected via drop or file picker. */
  onSelectFiles: (files: File[]) => void;

  /** Main label text. */
  label?: string;

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
      'rounded-2xl border border-dashed border-neutral-gray2 bg-neutral-offWhite',
      'px-12 py-8',
      'outline-hidden transition-colors duration-200',
      'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-500',
      'group-data-[drop-target]/dropzone:border-teal-500 group-data-[drop-target]/dropzone:bg-teal-50/30',
    ],
    iconWrapper: [
      'flex size-20 items-center justify-center rounded-full bg-neutral-gray1',
      'group-data-[drop-target]/dropzone:bg-teal-100',
    ],
    icon: [
      'size-10 text-neutral-gray4',
      'group-data-[drop-target]/dropzone:text-teal-600',
    ],
    labelWrapper: 'flex flex-col items-center gap-1',
    label: 'text-base text-neutral-charcoal',
    browse: 'text-teal-500 hover:text-teal-600 hover:underline',
    description: 'text-base text-neutral-gray4',
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
