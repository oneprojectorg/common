'use client';

import { Button } from '@op/ui/Button';
import { Sidebar, useSidebar } from '@op/ui/Sidebar';
import type { IconType } from 'react-icons';
import { LuAlignJustify } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import type { FieldType } from '../../../proposalTemplate';
import { AddFieldMenu } from './AddFieldMenu';
import { getFieldIcon } from './fieldRegistry';

export interface SidebarFieldItem {
  id: string;
  label: string;
  /** Field type used for icon lookup. Can be omitted when `icon` is provided. */
  fieldType?: FieldType;
  /** Override the icon instead of looking it up from fieldType. */
  icon?: IconType;
}

interface TemplateEditorSidebarProps {
  fields: SidebarFieldItem[];
  onAddField: (type: FieldType) => void;
  side?: 'left' | 'right';
}

/**
 * Button to toggle the sidebar on mobile, showing the field list.
 */
export function FieldListTrigger() {
  const t = useTranslations();
  const { toggleSidebar } = useSidebar();

  return (
    <Button
      color="secondary"
      className="gap-2 text-neutral-charcoal"
      size="small"
      onPress={toggleSidebar}
    >
      <LuAlignJustify className="size-4" />
      {t('Field list')}
    </Button>
  );
}

/**
 * Sidebar for the template editor showing available fields
 * and an "Add field" button.
 *
 * On desktop: renders as a fixed sidebar
 * On mobile: renders as a slide-out drawer via the Sidebar component
 */
export function TemplateEditorSidebar({
  fields,
  onAddField,
  side,
}: TemplateEditorSidebarProps) {
  const t = useTranslations();

  return (
    <Sidebar
      label={t('Template editor sidebar')}
      className="border-r"
      side={side}
    >
      <SidebarContent fields={fields} onAddField={onAddField} />
    </Sidebar>
  );
}

/**
 * Inner content of the sidebar, shared between desktop and mobile views.
 */
function SidebarContent({
  fields,
  onAddField,
}: Omit<TemplateEditorSidebarProps, 'side'>) {
  const t = useTranslations();
  const { setOpen, isMobile } = useSidebar();

  const handleAddField = (type: FieldType) => {
    onAddField(type);
    if (isMobile) {
      setOpen(false);
    }
  };

  return (
    <nav className="flex flex-col gap-2 p-4">
      {/* Add field button - hidden on mobile (shown at bottom instead) */}
      <div className="hidden md:block">
        <AddFieldMenu onAddField={handleAddField} />
      </div>

      <div className="mt-2 md:mt-4">
        <h3 className="mb-2 text-sm font-medium text-neutral-gray4">
          {t('Fields')}
        </h3>
        <ul className="space-y-1">
          {fields.map((field) => {
            const Icon =
              field.icon ??
              (field.fieldType ? getFieldIcon(field.fieldType) : undefined);
            if (!Icon) {
              return null;
            }
            return (
              <li key={field.id}>
                <div className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm text-neutral-charcoal">
                  <Icon className="size-4 shrink-0 text-neutral-gray4" />
                  <span className="truncate">{field.label}</span>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
