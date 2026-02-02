'use client';

import type React from 'react';
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
import type { VariantProps } from 'tailwind-variants';

/**
 * Accepted file type presets for common use cases.
 */
export type FileDropZoneAccept =
  | 'any'
  | 'images'
  | 'documents'
  | 'spreadsheets'
  | 'pdf'
  | 'csv';

export interface FileDropZoneProps extends VariantProps<typeof dropZoneStyles> {
  /**
   * File types to accept. Can be a preset string or an array of MIME types/extensions.
   * @default 'any'
   */
  acceptedFileTypes?: FileDropZoneAccept | string[];

  /**
   * Callback when files are selected via drop or file picker.
   */
  onSelectFiles: (files: File[]) => void;

  /**
   * Custom content to render inside the drop zone.
   * When provided, replaces the default icon, label, and description.
   */
  children?: React.ReactNode;

  /**
   * Custom icon element to display. Defaults to a file-plus icon.
   */
  icon?: React.ReactNode;

  /**
   * Main label text. Defaults to "Drag a file here or browse".
   */
  label?: string;

  /**
   * Description text shown below the label (e.g., accepted formats, size limits).
   */
  description?: string;

  /**
   * Whether the drop zone is disabled.
   */
  isDisabled?: boolean;

  /**
   * Whether to allow selecting multiple files.
   * @default true
   */
  allowsMultiple?: boolean;

  /**
   * Additional class name for the outer container.
   */
  className?: string;
}

const dropZoneStyles = tv({
  slots: {
    root: 'group/dropzone flex w-full',
    button: [
      'flex flex-1 cursor-pointer flex-col items-center justify-center gap-6',
      'rounded-lg border border-dashed border-neutral-gray2 bg-neutral-offWhite',
      'px-12 py-6',
      'outline-hidden transition-colors duration-200',
      'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-500',
      // Drop target state
      'group-data-[drop-target]/dropzone:border-teal-500 group-data-[drop-target]/dropzone:bg-teal-50/30',
    ],
    iconWrapper: [
      'flex size-16 items-center justify-center rounded-full bg-neutral-gray1',
      'group-data-[drop-target]/dropzone:bg-teal-100',
    ],
    icon: [
      'size-8 text-neutral-gray4',
      'group-data-[drop-target]/dropzone:text-teal-600',
    ],
    labelWrapper: 'flex flex-col items-center gap-1',
    label: 'text-body-md text-neutral-charcoal',
    browse: 'text-teal-500 hover:text-teal-600 hover:underline',
    description: 'text-body-sm text-neutral-gray4',
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
 * Returns MIME types and extensions for a given preset.
 */
function getAcceptedTypes(
  acceptedFileTypes: FileDropZoneAccept | string[],
): string[] | undefined {
  if (Array.isArray(acceptedFileTypes)) {
    return acceptedFileTypes;
  }

  switch (acceptedFileTypes) {
    case 'images':
      return ['image/*'];
    case 'documents':
      return [
        'application/pdf',
        '.pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        '.docx',
        'application/msword',
        '.doc',
      ];
    case 'spreadsheets':
      return [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        '.xlsx',
        'application/vnd.ms-excel',
        '.xls',
        'text/csv',
        '.csv',
      ];
    case 'pdf':
      return ['application/pdf', '.pdf'];
    case 'csv':
      return ['text/csv', '.csv'];
    case 'any':
      return undefined;
  }
}

/**
 * FileDropZone - A file upload zone where users can drop files or click to browse.
 *
 * @example
 * ```tsx
 * <FileDropZone
 *   acceptedFileTypes="documents"
 *   description="Accepts PDF, DOCX up to 10MB"
 *   onSelectFiles={(files) => console.log(files)}
 * />
 * ```
 */
export function FileDropZone(props: FileDropZoneProps) {
  const {
    acceptedFileTypes = 'any',
    onSelectFiles,
    children,
    icon,
    label,
    description,
    isDisabled = false,
    allowsMultiple = true,
    className,
  } = props;

  const styles = dropZoneStyles({ isDisabled });
  const fileTypes = getAcceptedTypes(acceptedFileTypes);

  const handleDrop = async (event: DropEvent) => {
    const fileItems = event.items.filter(isFileDropItem);
    const files = await Promise.all(fileItems.map((item) => item.getFile()));
    if (files.length > 0) {
      onSelectFiles(files);
    }
  };

  const handleSelect = (fileList: FileList | null) => {
    if (!fileList) {
      return;
    }
    const files = Array.from(fileList);
    onSelectFiles(files);
  };

  return (
    <DropZone
      className={styles.root({ className })}
      getDropOperation={(types) => {
        if (!fileTypes) {
          return 'copy';
        }
        const hasValidType = fileTypes.some((type) => types.has(type));
        return hasValidType ? 'copy' : 'cancel';
      }}
      onDrop={handleDrop}
      isDisabled={isDisabled}
    >
      <FileTrigger
        allowsMultiple={allowsMultiple}
        acceptedFileTypes={fileTypes}
        onSelect={handleSelect}
      >
        <Button className={styles.button()} isDisabled={isDisabled}>
          {children ?? (
            <>
              <div className={styles.iconWrapper()}>
                {icon ?? <LuFilePlus2 className={styles.icon()} />}
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
            </>
          )}
        </Button>
      </FileTrigger>
    </DropZone>
  );
}
