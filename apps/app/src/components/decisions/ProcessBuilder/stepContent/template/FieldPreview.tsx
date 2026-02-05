import { LuChevronDown } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { getFieldPlaceholderKey } from './fieldRegistry';
import type { FormField } from './types';

interface FieldPreviewProps {
  field: FormField;
}

/**
 * Renders a preview of a form field based on its type.
 * These are non-interactive previews showing what the field will look like.
 */
export function FieldPreview({ field }: FieldPreviewProps) {
  const t = useTranslations();
  const placeholderKey = getFieldPlaceholderKey(field.type);
  const placeholder = field.placeholder ?? t(placeholderKey);

  switch (field.type) {
    case 'short_text':
      return (
        <div className="rounded-md border border-neutral-gray2 bg-white px-3 py-2 text-neutral-gray4">
          {placeholder}
        </div>
      );

    case 'long_text':
      return (
        <div className="min-h-20 rounded-md border border-neutral-gray2 bg-white px-3 py-2 text-neutral-gray4">
          {placeholder}
        </div>
      );

    case 'dropdown':
      return (
        <div className="flex items-center justify-between rounded-md border border-neutral-gray2 bg-white px-3 py-2 text-neutral-gray4">
          <span>{placeholder}</span>
          <LuChevronDown className="size-4" />
        </div>
      );

    case 'multiple_choice':
      return (
        <div className="space-y-2">
          {(field.options?.length
            ? field.options
            : ['Option 1', 'Option 2']
          ).map((option, index) => (
            <div key={index} className="flex items-center gap-2">
              <div className="size-4 rounded border border-neutral-gray3 bg-white" />
              <span className="text-neutral-gray4">{option}</span>
            </div>
          ))}
        </div>
      );

    case 'yes_no':
      return (
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2">
            <div className="size-4 rounded-full border border-neutral-gray3 bg-white" />
            <span className="text-neutral-gray4">{t('Yes')}</span>
          </label>
          <label className="flex items-center gap-2">
            <div className="size-4 rounded-full border border-neutral-gray3 bg-white" />
            <span className="text-neutral-gray4">{t('No')}</span>
          </label>
        </div>
      );

    case 'date':
      return (
        <div className="flex items-center justify-between rounded-md border border-neutral-gray2 bg-white px-3 py-2 text-neutral-gray4">
          <span>{placeholder}</span>
        </div>
      );

    case 'number':
      return (
        <div className="rounded-md border border-neutral-gray2 bg-white px-3 py-2 text-neutral-gray4">
          {placeholder}
        </div>
      );

    case 'attachments':
      return (
        <div className="flex items-center justify-center rounded-md border border-dashed border-neutral-gray3 bg-white px-3 py-4 text-neutral-gray4">
          {placeholder}
        </div>
      );

    case 'video':
    case 'audio':
      return (
        <div className="rounded-md border border-neutral-gray2 bg-white px-3 py-2 text-neutral-gray4">
          {placeholder}
        </div>
      );

    case 'section':
      return <hr className="border-neutral-gray2" />;

    default:
      return null;
  }
}
