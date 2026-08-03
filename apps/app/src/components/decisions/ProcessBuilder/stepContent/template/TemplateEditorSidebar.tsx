'use client';

import { Button } from '@op/sense/Button';
import { Header4 } from '@op/sense/Header';
import { Sidebar, useSidebar } from '@op/sense/Sidebar';
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
  disabledTypes?: FieldType[];
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
      variant="outline"
      className="gap-2 text-neutral-charcoal"
      size="sm"
      onClick={toggleSidebar}
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
  disabledTypes,
  side,
}: TemplateEditorSidebarProps) {
  return (
    // TODO(sense-migration): the sense shadcn Sidebar is an app-shell component
    // (fixed desktop positioning; SidebarProvider injects a `min-h-svh` wrapper)
    // whereas @op/ui's Sidebar was an inline sticky panel. The inline
    // content-area layout used here needs a visual QA pass.
    <Sidebar className="border-e" side={side}>
      <SidebarContent
        fields={fields}
        onAddField={onAddField}
        disabledTypes={disabledTypes}
      />
    </Sidebar>
  );
}

/**
 * Inner content of the sidebar, shared between desktop and mobile views.
 */
function SidebarContent({
  fields,
  onAddField,
  disabledTypes,
}: Omit<TemplateEditorSidebarProps, 'side'>) {
  const t = useTranslations();
  const { setOpenMobile, isMobile } = useSidebar();

  const handleAddField = (type: FieldType) => {
    onAddField(type);
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  return (
    <nav className="flex flex-col gap-2 p-4">
      {/* Add field button - hidden on mobile (shown at bottom instead) */}
      <div className="hidden md:block">
        <AddFieldMenu
          onAddField={handleAddField}
          disabledTypes={disabledTypes}
        />
      </div>

      <div className="mt-2 md:mt-4">
        <Header4 className="mb-2">{t('Fields')}</Header4>
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
                <div className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-start text-base text-neutral-charcoal">
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
