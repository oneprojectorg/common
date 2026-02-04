'use client';

import { Sidebar, SidebarTrigger, useSidebar } from '@op/ui/Sidebar';
import { LuHouse } from 'react-icons/lu';

import { Link, useTranslations } from '@/lib/i18n';

import { AddFieldMenu } from './AddFieldMenu';
import { getFieldIcon } from './fieldRegistry';
import type { FieldType, FormField } from './types';

interface FormBuilderSidebarProps {
  fields: FormField[];
  onAddField: (type: FieldType) => void;
  onFieldSelect?: (fieldId: string) => void;
}

/**
 * Sidebar trigger button for mobile - shows hamburger menu icon.
 */
export function FormBuilderMobileTrigger() {
  return <SidebarTrigger className="size-4 md:hidden" />;
}

/**
 * Sidebar for the form builder showing available fields
 * and an "Add field" button.
 *
 * On desktop: renders as a fixed sidebar
 * On mobile: renders as a slide-out drawer via the Sidebar component
 */
export function FormBuilderSidebar({
  fields,
  onAddField,
  onFieldSelect,
}: FormBuilderSidebarProps) {
  const t = useTranslations();

  return (
    <Sidebar label={t('Form builder sidebar')} className="border-r">
      <SidebarContent
        fields={fields}
        onAddField={onAddField}
        onFieldSelect={onFieldSelect}
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
  onFieldSelect,
}: FormBuilderSidebarProps) {
  const t = useTranslations();
  const { setOpen, isMobile } = useSidebar();

  const handleAddField = (type: FieldType) => {
    onAddField(type);
    if (isMobile) {
      setOpen(false);
    }
  };

  const handleFieldSelect = (fieldId: string) => {
    onFieldSelect?.(fieldId);
    if (isMobile) {
      setOpen(false);
    }
  };

  return (
    <nav className="flex flex-col gap-2 p-4">
      {/* Home link - mobile only */}
      <Link
        href="/"
        className="flex h-8 items-center gap-2 px-2 text-primary-teal md:hidden"
      >
        <LuHouse className="size-4" />
        {t('Home')}
      </Link>
      <hr className="md:hidden" />

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
            const Icon = getFieldIcon(field.type);
            return (
              <li key={field.id}>
                <button
                  type="button"
                  onClick={() => handleFieldSelect(field.id)}
                  className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm text-neutral-charcoal hover:bg-neutral-gray1"
                >
                  <Icon size={16} className="shrink-0 text-neutral-gray4" />
                  <span className="truncate">{field.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
